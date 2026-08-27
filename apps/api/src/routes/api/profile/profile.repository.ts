import { Database } from '@repo/types';
import { SupabaseClient } from '@supabase/supabase-js';
import { prisma } from '../../../lib/prisma';
import {
  prismaAuditUpdate,
  prismaLockTimestamp,
} from '../../../lib/prisma-audit';
import { resolveOptimisticPrismaUpdate } from '../../../lib/optimistic-lock';

export type ProfileUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  profile_picture: string | null;
  cover_picture: string | null;
  updated_at: string;
};

const PROFILE_USER_SELECT =
  'id, name, email, role, profile_picture, cover_picture, updated_at' as const;

export class ProfileRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async getProfileUser(userId: string) {
    const { data, error } = await this.db
      .from('users')
      .select(PROFILE_USER_SELECT)
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('error. failed to load profile user:', error.message);
      throw new Error('Failed to load profile.');
    }

    return data as ProfileUser | null;
  }

  async updateOwnName(
    userId: string,
    input: { name: string; expectedUpdatedAt: string }
  ) {
    const { count } = await prisma.users.updateMany({
      where: {
        id: userId,
        updated_at: prismaLockTimestamp(input.expectedUpdatedAt),
      },
      data: {
        name: input.name,
        ...prismaAuditUpdate(userId),
      },
    });

    return resolveOptimisticPrismaUpdate({
      count,
      fetchUpdated: () => this.getProfileUser(userId),
      fetchCurrent: () => this.getProfileUser(userId),
      notFoundMessage: 'User profile not found.',
    });
  }
}
