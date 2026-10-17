import {
  Database,
  PROFILE_USER_POSTGREST_SELECT,
  profileDetailSelect,
  type ProfileDetailRow,
  type ProfileUserWire,
  type UpdateOwnProfileBody,
} from '@repo/types';
import { SupabaseClient } from '@supabase/supabase-js';
import { prisma } from '../../../lib/prisma';
import {
  prismaAuditUpdate,
  prismaLockTimestamp,
} from '../../../lib/prisma-audit';
import { resolveOptimisticPrismaUpdate } from '../../../lib/optimistic-lock';

export type ProfileUser = ProfileUserWire;

export class ProfileRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async getProfileUser(userId: string): Promise<ProfileUser | null> {
    const { data, error } = await this.db
      .from('users')
      .select(PROFILE_USER_POSTGREST_SELECT)
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('error. failed to load profile user:', error.message);
      throw new Error('Failed to load profile.');
    }

    return data as ProfileUser | null;
  }

  async getProfileUserPrisma(userId: string): Promise<ProfileDetailRow | null> {
    try {
      return await prisma.users.findUnique({
        where: { id: userId },
        select: profileDetailSelect,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('error. failed to load profile user (Prisma):', message);
      throw new Error('Failed to load profile.');
    }
  }

  /** Post-mutation profile wire row via Prisma (ISO `updated_at`). */
  async getMutationProfileUser(userId: string): Promise<ProfileUser | null> {
    const row = await this.getProfileUserPrisma(userId);
    if (!row) {
      return null;
    }
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      profile_picture: row.profile_picture,
      cover_picture: row.cover_picture,
      updated_at: row.updated_at.toISOString(),
    };
  }

  async updateOwnName(userId: string, input: UpdateOwnProfileBody) {
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
      fetchUpdated: () => this.getMutationProfileUser(userId),
      fetchCurrent: () => this.getMutationProfileUser(userId),
      notFoundMessage: 'User profile not found.',
    });
  }
}
