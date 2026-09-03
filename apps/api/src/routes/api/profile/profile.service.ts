import type { ProfileDetailRow, UpdateOwnProfileBody } from '@repo/types';
import { env } from '../../../config/env';
import { resolveOptimisticPrismaUpdate } from '../../../lib/optimistic-lock';
import { prisma } from '../../../lib/prisma';
import {
  prismaAuditUpdate,
  prismaLockTimestamp,
} from '../../../lib/prisma-audit';
import { uploadPublicImageReplacingPrevious } from '../../../lib/public-image-upload';
import { ProfileRepository, ProfileUser } from './profile.repository';

type ProfileImageField = 'profile_picture' | 'cover_picture';

export class ProfileService {
  constructor(private readonly profileRepository: ProfileRepository) {}

  async getOwnProfile(userId: string): Promise<ProfileDetailRow | null> {
    return this.profileRepository.getProfileUserPrisma(userId);
  }

  private async findProfileUser(userId: string): Promise<ProfileUser | null> {
    return await this.profileRepository.getProfileUser(userId);
  }

  async updateOwnName(
    userId: string,
    input: UpdateOwnProfileBody
  ): Promise<ProfileUser> {
    return this.profileRepository.updateOwnName(userId, input);
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
