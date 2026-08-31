import { Constants } from './generated/supabase/database.types.js';

export {
  UserRole as UserRoleEnum,
  UserMembershipStatus as UserMembershipStatusEnum,
} from './generated/prisma/enums.js';

export const USER_ROLES = Constants.public.Enums.UserRole;
export type UserRole = (typeof USER_ROLES)[number];

export const USER_MEMBERSHIP_STATUSES =
  Constants.public.Enums.UserMembershipStatus;
export type UserMembershipStatus = (typeof USER_MEMBERSHIP_STATUSES)[number];

/** Kill switch on + membership joined — required to use the product. */
export type ProductUsableUserFields = {
  active: boolean;
  membership_status: UserMembershipStatus;
};

export function isProductUsableUser(user: ProductUsableUserFields): boolean {
  return user.active && user.membership_status === 'active';
}

/**
 * PostgREST filter for product-usable users (assignees, chat picks, admin lists).
 * Chain after `.from('users').select(...)`.
 *
 * Uses a structural cast: supabase-js filter builders are too deep for a
 * precise generic `eq` constraint.
 */
export function filterProductUsableUsers<Q>(query: Q): Q {
  const chain = query as {
    eq: (column: string, value: boolean | string) => typeof chain;
  };
  return chain.eq('active', true).eq('membership_status', 'active') as Q;
}

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

export {
  createUserSchema,
  updateUserSchema,
} from './api/v1/users.js';

