import { z } from 'zod';
import { Constants } from '../../generated/supabase/database.types.js';
import type { usersGetPayload } from '../../generated/prisma/models/users.js';
import { expectedUpdatedAtSchema } from '../../optimistic-lock.js';

/**
 * PostgREST column list for self-service profile reads (optimistic-lock follow-ups).
 * Field list must stay aligned with `profileDetailSelect`.
 */
export const PROFILE_USER_POSTGREST_SELECT =
  'id, name, email, role, profile_picture, cover_picture, updated_at' as const;

/** Prisma `select` for unused Express self-profile GET (signed-in user detail). */
export const profileDetailSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  profile_picture: true,
  cover_picture: true,
  updated_at: true,
} as const;

export type ProfileDetailRow = usersGetPayload<{
  select: typeof profileDetailSelect;
}>;

const userRoleSchema = z.enum(Constants.public.Enums.UserRole);

/** Wire shape for profile user rows returned by profile mutations and unused GET. */
export const profileUserWireSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  email: z.string(),
  role: userRoleSchema,
  profile_picture: z.string().nullable(),
  cover_picture: z.string().nullable(),
  updated_at: z.string(),
});

export type ProfileUserWire = z.infer<typeof profileUserWireSchema>;

/** Body for self-service name update (`PATCH /api/profile`). */
export const updateOwnProfileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Name must be at least 2 characters.')
    .max(100, 'Name must be at most 100 characters.'),
  expectedUpdatedAt: expectedUpdatedAtSchema,
});

export type UpdateOwnProfileBody = z.infer<typeof updateOwnProfileSchema>;

export const profilePatchResponseSchema = z.object({
  user: profileUserWireSchema,
});

export type ProfilePatchResponse = z.infer<typeof profilePatchResponseSchema>;

export const profileImageUploadResultSchema = z.object({
  success: z.literal(true),
  url: z.string(),
  path: z.string(),
  user: profileUserWireSchema,
});

export type ProfileImageUploadResult = z.infer<
  typeof profileImageUploadResultSchema
>;
