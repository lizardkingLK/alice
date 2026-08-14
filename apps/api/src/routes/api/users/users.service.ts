import { supabase } from '../../../lib/supabase';
import { usersRepository, type UserRow } from './users.repository';
import { UserRoleEnum } from '@repo/types';

export class UsersServiceError extends Error {
  constructor(
    message: string,
    readonly status: 401 | 403 | 404
  ) {
    super(message);
    this.name = 'UsersServiceError';
  }
}

export function isUsersServiceError(
  error: unknown
): error is UsersServiceError {
  return error instanceof UsersServiceError;
}

async function requireAdmin(actorId: string) {
  const { data: user, error } = await supabase
    .from('users')
    .select('role')
    .eq('id', actorId)
    .single();

  if (error || !user) {
    throw new UsersServiceError('Not authenticated.', 401);
  }

  if (user.role !== UserRoleEnum.admin) {
    throw new UsersServiceError(
      'Unauthorized. Only administrators can perform this action.',
      403
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
    // Authorize before existence lookup so unauthorized callers cannot probe IDs.
    if (actor.type === 'admin') {
      await requireAdmin(actor.actorId);
    } else if (actor.type === 'self') {
      if (actor.actorId !== targetUserId) {
        throw new UsersServiceError(
          'Unauthorized. You can only deactivate your own account.',
          403
        );
      }
    } else if (actor.type === 'webhook') {
      // Authz is enforced at the webhook route (shared secret).
    }

    const target = await usersRepository.findById(targetUserId);
    if (!target) {
      throw new UsersServiceError('User not found.', 404);
    }

    if (!target.active) {
      await this.setAuthBanDuration(targetUserId, AUTH_BAN_DURATION, {
        requireSuccess: true,
      });
      this.logDeactivation('idempotent', actor.type);
      return target;
    }

    const actorIdForAudit =
      actor.type === 'webhook' ? targetUserId : actor.actorId;
    const expectedUpdatedAt = options?.expectedUpdatedAt ?? target.updated_at;

    let updated: UserRow;
    try {
      // Atomic last-admin check + deactivate (row lock in Postgres).
      updated = await usersRepository.deactivateGuarded(
        targetUserId,
        actorIdForAudit,
        expectedUpdatedAt
      );
    } catch (deactivateError) {
      if (
        deactivateError instanceof Error &&
        deactivateError.message.includes(
          'Cannot deactivate the last active admin'
        )
      ) {
        throw new UsersServiceError(deactivateError.message, 403);
      }
      throw deactivateError;
    }

    await this.setAuthBanDuration(targetUserId, AUTH_BAN_DURATION, {
      requireSuccess: true,
    });
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

  /**
   * Ban (`87600h`) or unban (`none`) in Supabase Auth.
   * Ban failures must propagate so callers can retry after a DB deactivate.
   */
  private async setAuthBanDuration(
    userId: string,
    banDuration: typeof AUTH_BAN_DURATION | 'none',
    options?: { requireSuccess?: boolean }
  ): Promise<void> {
    const { error: authError } = await supabase.auth.admin.updateUserById(
      userId,
      { ban_duration: banDuration }
    );

    if (authError) {
      console.error('Failed to update ban status in Supabase Auth');
      if (options?.requireSuccess && banDuration !== 'none') {
        throw new Error(
          'Account was deactivated but session revocation failed. Please retry.'
        );
      }
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
