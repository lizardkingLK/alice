import { z } from 'zod';
import { Constants } from './generated/supabase/database.types.js';

export { UserRole as UserRoleEnum } from './generated/prisma/enums.js';

export const USER_ROLES = Constants.public.Enums.UserRole;
export type UserRole = (typeof USER_ROLES)[number];

/** Shared Supabase user column list for embeds / selects that need avatar. */
export const USER_PROJECTION = 'id, name, email, profile_picture' as const;

/** Project-member / author embeds also include role. */
export const USER_PROJECTION_WITH_ROLE =
  'id, name, email, role, profile_picture' as const;

export type UserProjection =
  typeof USER_PROJECTION | typeof USER_PROJECTION_WITH_ROLE;

/** Build a PostgREST user relation embed, e.g. `assignee:users!assignee_id(...)`. */
export function userRelationSelect(
  alias: string,
  foreignKeyHint: string,
  projection: UserProjection = USER_PROJECTION
): string {
  return `${alias}:users!${foreignKeyHint}(${projection})`;
}

export const createUserSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }),
  email: z.email({ message: 'Please enter a valid email address.' }),
  role: z.enum(USER_ROLES),
});

export const updateUserSchema = z.object({
  id: z.uuid({ message: 'Invalid user ID.' }),
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }),
  role: z.enum(USER_ROLES),
});
