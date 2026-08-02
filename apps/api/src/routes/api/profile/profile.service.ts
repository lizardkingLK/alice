import { expectedUpdatedAtSchema } from '@repo/types';
import { z } from 'zod';
import { auditUpdate } from '../../../lib/audit';
import { env } from '../../../config/env';
import {
  getPublicStorageUrl,
  removeStorageObjects,
  sanitizeFileName,
  storagePathFromPublicUrl,
  uploadToStorage,
} from '../../../lib/file-helpers';
import { resolveOptimisticUpdate } from '../../../lib/optimistic-lock';
import { supabase } from '../../../lib/supabase';

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

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
  updated_at: string;
};

const PROFILE_USER_SELECT =
  'id, name, email, role, profile_picture, updated_at' as const;

export class ProfileService {
  private async findProfileUser(userId: string): Promise<ProfileUser | null> {
    const { data, error } = await supabase
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
    const { data: user, error } = await supabase
      .from('users')
      .update({
        name: input.name,
        ...auditUpdate(userId),
      })
      .eq('id', userId)
      .eq('updated_at', input.expectedUpdatedAt)
      .select(PROFILE_USER_SELECT)
      .maybeSingle();

    return (await resolveOptimisticUpdate({
      data: user as ProfileUser | null,
      error,
      fetchCurrent: () => this.findProfileUser(userId),
      notFoundMessage: 'User profile not found.',
    })) as ProfileUser;
  }

  async updateOwnProfilePicture(
    userId: string,
    file: Express.Multer.File,
    expectedUpdatedAt: string
  ): Promise<{ success: true; url: string; path: string; user: ProfileUser }> {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new Error('Invalid file type. Use JPEG, PNG, WebP, or GIF.');
    }

    const bucket = env.STORAGE_BUCKET_PROFILE_PICTURES;
    const safeName = sanitizeFileName(file.originalname, 'avatar');
    const objectPath = `${userId}/${Date.now()}-${safeName}`;

    const existing = await this.findProfileUser(userId);
    if (!existing) {
      throw new Error('User profile not found.');
    }

    const uploaded = await uploadToStorage({
      bucket,
      path: objectPath,
      buffer: file.buffer,
      contentType: file.mimetype,
    });

    const { data: updated, error: updateError } = await supabase
      .from('users')
      .update({
        profile_picture: getPublicStorageUrl(bucket, uploaded.path),
        ...auditUpdate(userId),
      })
      .eq('id', userId)
      .eq('updated_at', expectedUpdatedAt)
      .select(PROFILE_USER_SELECT)
      .maybeSingle();

    let resolvedUser: ProfileUser;
    try {
      resolvedUser = (await resolveOptimisticUpdate({
        data: updated as ProfileUser | null,
        error: updateError,
        fetchCurrent: () => this.findProfileUser(userId),
        notFoundMessage: 'User profile not found.',
      })) as ProfileUser;
    } catch (error) {
      await removeStorageObjects(bucket, [uploaded.path]);
      throw error;
    }

    const previousUrl = existing.profile_picture;
    if (previousUrl) {
      const previousPath = storagePathFromPublicUrl(previousUrl, bucket);
      if (previousPath && previousPath !== uploaded.path) {
        await removeStorageObjects(bucket, [previousPath]);
      }
    }

    return {
      success: true,
      url: resolvedUser.profile_picture!,
      path: uploaded.path,
      user: resolvedUser,
    };
  }
}

export const profileService = new ProfileService();
