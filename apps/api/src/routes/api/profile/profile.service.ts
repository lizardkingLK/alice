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
});

export type UpdateOwnProfileInput = z.infer<typeof updateOwnProfileSchema>;

export type ProfileUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  profile_picture: string | null;
};

export class ProfileService {
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
      .select('id, name, email, role, profile_picture')
      .maybeSingle();

    if (error) {
      console.error('error. failed to update own profile:', error.message);
      throw new Error('Failed to update profile.');
    }

    if (!user) {
      throw new Error('User profile not found.');
    }

    return user as ProfileUser;
  }

  async updateOwnProfilePicture(
    userId: string,
    file: Express.Multer.File
  ): Promise<{ success: true; url: string; path: string; user: ProfileUser }> {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new Error('Invalid file type. Use JPEG, PNG, WebP, or GIF.');
    }

    const bucket = env.STORAGE_BUCKET_PROFILE_PICTURES;
    const safeName = sanitizeFileName(file.originalname, 'avatar');
    const objectPath = `${userId}/${Date.now()}-${safeName}`;

    const { data: existing, error: lookupError } = await supabase
      .from('users')
      .select('id, name, email, role, profile_picture')
      .eq('id', userId)
      .maybeSingle();

    if (lookupError) {
      console.error(
        'error. failed to load user before profile picture upload:',
        lookupError.message
      );
      throw new Error('Failed to update profile picture.');
    }

    if (!existing) {
      throw new Error('User profile not found.');
    }

    const uploaded = await uploadToStorage({
      bucket,
      path: objectPath,
      buffer: file.buffer,
      contentType: file.mimetype,
    });

    const publicUrl = getPublicStorageUrl(bucket, uploaded.path);

    const { data: updated, error: updateError } = await supabase
      .from('users')
      .update({
        profile_picture: publicUrl,
        ...auditUpdate(userId),
      })
      .eq('id', userId)
      .select('id, name, email, role, profile_picture')
      .maybeSingle();

    if (updateError || !updated) {
      console.error(
        'error. failed to persist profile picture URL:',
        updateError?.message ?? 'missing user'
      );
      await removeStorageObjects(bucket, [uploaded.path]);
      throw new Error('Failed to save profile picture.');
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
      url: publicUrl,
      path: uploaded.path,
      user: updated as ProfileUser,
    };
  }
}

export const profileService = new ProfileService();
