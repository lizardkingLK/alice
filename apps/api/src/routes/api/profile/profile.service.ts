import type { Database } from '@repo/types';
import type { SupabaseClient } from '@supabase/supabase-js';
import { expectedUpdatedAtSchema } from '@repo/types';
import { z } from 'zod';
import { env } from '../../../config/env';
import { resolveOptimisticPrismaUpdate } from '../../../lib/optimistic-lock';
import { prisma } from '../../../lib/prisma';
import {
  prismaAuditUpdate,
  prismaLockTimestamp,
} from '../../../lib/prisma-audit';
import { uploadPublicImageReplacingPrevious } from '../../../lib/public-image-upload';

export const updateOwnProfileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Name must be at least 2 characters.')
    .max(100, 'Name must be at most 100 characters.'),
  expectedUpdatedAt: expectedUpdatedAtSchema,
});

export type UpdateOwnProfileInput = z.infer<typeof updateOwnProfileSchema>;

export type ProfileUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  profile_picture: string | null;
  cover_picture: string | null;
  updated_at: string;
};

type ProfileImageField = 'profile_picture' | 'cover_picture';

const PROFILE_USER_SELECT =
  'id, name, email, role, profile_picture, cover_picture, updated_at' as const;

export class ProfileService {
  constructor(private readonly db: SupabaseClient<Database>) {}

  private async findProfileUser(userId: string): Promise<ProfileUser | null> {
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
    input: UpdateOwnProfileInput
  ): Promise<ProfileUser> {
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
      fetchUpdated: () => this.findProfileUser(userId),
      fetchCurrent: () => this.findProfileUser(userId),
      notFoundMessage: 'User profile not found.',
    });
  }

  async updateOwnProfilePicture(
    userId: string,
    file: Express.Multer.File,
    expectedUpdatedAt: string
  ): Promise<{ success: true; url: string; path: string; user: ProfileUser }> {
    return this.updateOwnImageField(userId, file, expectedUpdatedAt, {
      bucket: env.STORAGE_BUCKET_PROFILE_PICTURES,
      field: 'profile_picture',
      fileNameFallback: 'avatar',
    });
  }

  async updateOwnCoverPicture(
    userId: string,
    file: Express.Multer.File,
    expectedUpdatedAt: string
  ): Promise<{ success: true; url: string; path: string; user: ProfileUser }> {
    return this.updateOwnImageField(userId, file, expectedUpdatedAt, {
      bucket: env.STORAGE_BUCKET_PROFILE_COVERS,
      field: 'cover_picture',
      fileNameFallback: 'cover',
    });
  }

  private async updateOwnImageField(
    userId: string,
    file: Express.Multer.File,
    expectedUpdatedAt: string,
    options: {
      bucket: string;
      field: ProfileImageField;
      fileNameFallback: string;
    }
  ): Promise<{ success: true; url: string; path: string; user: ProfileUser }> {
    const { bucket, field, fileNameFallback } = options;

    const existing = await this.findProfileUser(userId);
    if (!existing) {
      throw new Error('User profile not found.');
    }

    let resolvedUser!: ProfileUser;
    const uploaded = await uploadPublicImageReplacingPrevious({
      file,
      bucket,
      ownerKey: userId,
      fileNameFallback,
      previousPublicUrl: existing[field],
      persistUrl: async (publicUrl) => {
        const { count } = await prisma.users.updateMany({
          where: {
            id: userId,
            updated_at: prismaLockTimestamp(expectedUpdatedAt),
          },
          data: {
            [field]: publicUrl,
            ...prismaAuditUpdate(userId),
          },
        });

        resolvedUser = await resolveOptimisticPrismaUpdate({
          count,
          fetchUpdated: () => this.findProfileUser(userId),
          fetchCurrent: () => this.findProfileUser(userId),
          notFoundMessage: 'User profile not found.',
        });
      },
    });

    return {
      success: true,
      url: resolvedUser[field]!,
      path: uploaded.path,
      user: resolvedUser,
    };
  }
}
