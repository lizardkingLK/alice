import { Constants, UserRoleEnum, type Enums } from '@repo/types';

/** Application RBAC role from `public.users.role`. */
export type AppRole = Enums<'UserRole'>;

export const APP_ROLES = Constants.public.Enums.UserRole;

/** Higher index = more privilege (member < manager < admin). */
const ROLE_RANK: Record<AppRole, number> = {
  [UserRoleEnum.member]: 0,
  [UserRoleEnum.manager]: 1,
  [UserRoleEnum.admin]: 2,
};

export function isAppRole(value: unknown): value is AppRole {
  return (
    typeof value === 'string' &&
    (APP_ROLES as readonly string[]).includes(value)
  );
}

/** True when `role` meets or exceeds `minimum` in the hierarchy. */
export function roleAtLeast(
  role: AppRole | null | undefined,
  minimum: AppRole
): boolean {
  if (!role || !isAppRole(role)) {
    return false;
  }
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}

export function isAdmin(role: AppRole | null | undefined): boolean {
  return role === UserRoleEnum.admin;
}

export function isManagerOrAdmin(role: AppRole | null | undefined): boolean {
  return roleAtLeast(role, UserRoleEnum.manager);
}
