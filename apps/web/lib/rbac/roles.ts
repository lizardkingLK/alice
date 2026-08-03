import type { Enums } from '@repo/types';

/** Application RBAC role from `public.users.role`. */
export type AppRole = Enums<'UserRole'>;

export const APP_ROLES = [
  'admin',
  'manager',
  'member',
] as const satisfies readonly AppRole[];

/** Higher index = more privilege (member < manager < admin). */
const ROLE_RANK: Record<AppRole, number> = {
  member: 0,
  manager: 1,
  admin: 2,
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
  return role === 'admin';
}

export function isManagerOrAdmin(role: AppRole | null | undefined): boolean {
  return roleAtLeast(role, 'manager');
}
