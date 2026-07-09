import { supabase } from '../../../lib/supabase';
import {
  usersRepository,
  type UserRow,
} from './users.repository';

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
    throw new Error('Unauthorized. Only administrators can perform this action.');
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
      throw new Error('A user with this email address already exists in the registry.');
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
    input: UpdateUserInput
  ): Promise<UserRow> {
    await requireAdmin(actorId);

    // 1. Update public.users table
    const updated = await usersRepository.update(
      targetUserId,
      {
        name: input.name,
        role: input.role,
      },
      actorId
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

  async toggleUserActive(
    actorId: string,
    targetUserId: string,
    active: boolean
  ): Promise<UserRow> {
    await requireAdmin(actorId);

    if (targetUserId === actorId && !active) {
      throw new Error('Self lockout protection: You cannot deactivate your own account.');
    }

    // 1. Update public.users status
    const updated = await usersRepository.update(
      targetUserId,
      {
        active,
      },
      actorId
    );

    // 2. Ban/unban in Supabase Auth to prevent logins
    const { error: authError } = await supabase.auth.admin.updateUserById(
      targetUserId,
      {
        ban_duration: active ? 'none' : '87600h',
      }
    );

    if (authError) {
      console.error('Failed to update ban status in Supabase Auth');
    }

    return updated;
  }
}

export const usersService = new UsersService();
