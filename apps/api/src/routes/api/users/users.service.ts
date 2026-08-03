import { supabase } from '../../../lib/supabase';
import { usersRepository, type UserRow } from './users.repository';

async function requireAdmin(actorId: string) {
  const { data: user, error } = await supabase
    .from('users')
    .select('role')
    .eq('id', actorId)
    .single();

  if (error || !user) {
    throw new Error('Not authenticated.');
  }

  if (user.role !== 'admin') {
    throw new Error(
      'Unauthorized. Only administrators can perform this action.'
    );
  }
  return user;
}

export type CreateUserInput = {
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'member';
  redirectTo: string;
};

export type UpdateUserInput = {
  name: string;
  role: 'admin' | 'manager' | 'member';
};

export type DeactivateActor =
  | { type: 'admin'; actorId: string }
  | { type: 'self'; actorId: string }
  | { type: 'webhook'; source: string };

const AUTH_BAN_DURATION = '87600h';

export class UsersService {
  async listUsers(actorId: string): Promise<UserRow[]>;
  async listUsers(
    actorId: string,
    page: number,
    limit: number
  ): Promise<{ users: UserRow[]; totalCount: number }>;
  async listUsers(
    _actorId: string,
    page?: number,
    limit?: number
  ): Promise<{ users: UserRow[]; totalCount: number } | UserRow[]> {
    // Any authenticated user can view the registry
    if (page !== undefined && limit !== undefined) {
      return await usersRepository.listPaginated(page, limit);
    }
    return await usersRepository.listAll();
  }

  async createUser(actorId: string, input: CreateUserInput): Promise<UserRow> {
    await requireAdmin(actorId);

    // Check duplicate email
    const existing = await usersRepository.findByEmail(input.email);
    if (existing) {
      throw new Error(
        'A user with this email address already exists in the registry.'
      );
    }

    // Invite user via Supabase Auth
    const { data: inviteData, error: inviteError } =
      await supabase.auth.admin.inviteUserByEmail(input.email, {
        redirectTo: input.redirectTo,
        data: {
          name: input.name,
          role: input.role,
        },
      });

    if (inviteError) {
      throw new Error(`Failed to invite user via Auth: ${inviteError.message}`);
    }

    const invitedUser = inviteData?.user;
    if (!invitedUser) {
      throw new Error('Failed to retrieve invited user details.');
    }

    try {
      // Insert into public.users
      return await usersRepository.create(
        {
          id: invitedUser.id,
          name: input.name,
          email: input.email,
          role: input.role,
        },
        actorId
      );
    } catch (dbError) {
      // Rollback Auth user if database insertion fails
      await supabase.auth.admin.deleteUser(invitedUser.id);
      throw dbError;
    }
  }

  async updateUser(
    actorId: string,
    targetUserId: string,
    input: UpdateUserInput,
    expectedUpdatedAt: string
  ): Promise<UserRow> {
    await requireAdmin(actorId);

    // 1. Update public.users table
    const updated = await usersRepository.update(
      targetUserId,
      {
        name: input.name,
        role: input.role,
      },
      actorId,
      expectedUpdatedAt
    );

    // 2. Sync metadata in Supabase Auth
    const { error: authError } = await supabase.auth.admin.updateUserById(
      targetUserId,
      {
        user_metadata: {
          name: input.name,
          role: input.role,
        },
      }
    );

    if (authError) {
      console.error('Failed to update user metadata in Supabase Auth');
    }

    return updated;
  }

  /**
   * Shared kill switch: `public.users.active = false` + Auth ban.
   * Used by admin toggle, self-deactivate, and (later) webhook.
   */
  async deactivateUser(
    targetUserId: string,
    actor: DeactivateActor,
    options?: { expectedUpdatedAt?: string }
  ): Promise<UserRow> {
    const target = await usersRepository.findById(targetUserId);
    if (!target) {
      throw new Error('User not found.');
    }

    if (actor.type === 'admin') {
      await requireAdmin(actor.actorId);
    } else if (actor.type === 'self') {
      if (actor.actorId !== targetUserId) {
        throw new Error(
          'Unauthorized. You can only deactivate your own account.'
        );
      }
    } else if (actor.type === 'webhook') {
      // Authz is enforced at the webhook route (shared secret).
    }

    if (!target.active) {
      await this.setAuthBanDuration(targetUserId, AUTH_BAN_DURATION);
      this.logDeactivation('idempotent', actor.type);
      return target;
    }

    if (target.role === 'admin') {
      const otherAdmins =
        await usersRepository.countOtherActiveAdmins(targetUserId);
      if (otherAdmins < 1) {
        throw new Error('Cannot deactivate the last active admin.');
      }
    }

    const actorIdForAudit =
      actor.type === 'webhook' ? targetUserId : actor.actorId;

    const expectedUpdatedAt = options?.expectedUpdatedAt ?? target.updated_at;

    const updated = await usersRepository.update(
      targetUserId,
      { active: false },
      actorIdForAudit,
      expectedUpdatedAt
    );

    await this.setAuthBanDuration(targetUserId, AUTH_BAN_DURATION);
    this.logDeactivation('deactivated', actor.type);

    return updated;
  }

  /**
   * Log only closed-enum actor types — never interpolate request ids/source
   * (Sonar tssecurity:S5145).
   */
  private logDeactivation(
    outcome: 'idempotent' | 'deactivated',
    actorType: DeactivateActor['type']
  ): void {
    switch (actorType) {
      case 'admin':
        console.warn(`warn. user deactivated (${outcome}): actor=admin`);
        return;
      case 'self':
        console.warn(`warn. user deactivated (${outcome}): actor=self`);
        return;
      case 'webhook':
        console.warn(`warn. user deactivated (${outcome}): actor=webhook`);
        return;
    }
  }

  /** Ban (`87600h`) or unban (`none`) in Supabase Auth. */
  private async setAuthBanDuration(
    userId: string,
    banDuration: typeof AUTH_BAN_DURATION | 'none'
  ): Promise<void> {
    const { error: authError } = await supabase.auth.admin.updateUserById(
      userId,
      { ban_duration: banDuration }
    );

    if (authError) {
      console.error('Failed to update ban status in Supabase Auth');
    }
  }

  async toggleUserActive(
    actorId: string,
    targetUserId: string,
    active: boolean,
    expectedUpdatedAt: string
  ): Promise<UserRow> {
    if (active) {
      await requireAdmin(actorId);

      const updated = await usersRepository.update(
        targetUserId,
        { active: true },
        actorId,
        expectedUpdatedAt
      );

      await this.setAuthBanDuration(targetUserId, 'none');
      return updated;
    }

    // Deactivate: admin (other user) or self (same user) via the same route.
    if (actorId === targetUserId) {
      return this.deactivateUser(
        targetUserId,
        { type: 'self', actorId },
        { expectedUpdatedAt }
      );
    }

    return this.deactivateUser(
      targetUserId,
      { type: 'admin', actorId },
      { expectedUpdatedAt }
    );
  }
}

export const usersService = new UsersService();
