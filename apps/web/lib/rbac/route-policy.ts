import { isAdmin, roleAtLeast, type AppRole } from '@/lib/rbac/roles';

export type NavGroupId =
  'platform' | 'system' | 'projects' | 'account' | 'help';

/** Minimum role required to see a sidebar group (null = any authenticated role). */
const NAV_GROUP_MINIMUM_ROLE: Record<NavGroupId, AppRole | null> = {
  platform: null,
  account: null,
  help: null,
  // Project registry is ACL-filtered for owners/members; any authenticated role.
  projects: null,
  system: 'admin',
};

export function canAccessNavGroup(
  role: AppRole | null | undefined,
  group: NavGroupId
): boolean {
  if (!role) {
    return false;
  }
  const minimum = NAV_GROUP_MINIMUM_ROLE[group];
  if (minimum === null) {
    return true;
  }
  return roleAtLeast(role, minimum);
}

/**
 * Path prefixes that require a minimum role.
 * Longer / more specific prefixes should be checked first via sort by length.
 */
const ROUTE_MINIMUM_ROLE: ReadonlyArray<{
  readonly prefix: string;
  readonly minimum: AppRole;
}> = [
  { prefix: '/users', minimum: 'admin' },
  // `/projects` is open to any authenticated role; workspace ACL filters rows.
  { prefix: '/sprints', minimum: 'manager' },
  { prefix: '/manager', minimum: 'manager' },
];

/** Returns the minimum role for a pathname, or null when any authenticated role may access. */
export function minimumRoleForPath(pathname: string): AppRole | null {
  const normalized =
    pathname.length > 1 && pathname.endsWith('/')
      ? pathname.slice(0, -1)
      : pathname;

  const match = [...ROUTE_MINIMUM_ROLE]
    .sort((a, b) => b.prefix.length - a.prefix.length)
    .find(
      ({ prefix }) =>
        normalized === prefix || normalized.startsWith(`${prefix}/`)
    );

  return match?.minimum ?? null;
}

export function canAccessPath(
  role: AppRole | null | undefined,
  pathname: string
): boolean {
  if (!role) {
    return false;
  }
  const minimum = minimumRoleForPath(pathname);
  if (minimum === null) {
    return true;
  }
  return roleAtLeast(role, minimum);
}

export function canAccessSystemNav(role: AppRole | null | undefined): boolean {
  return isAdmin(role);
}

export function canAccessProjectsNav(
  role: AppRole | null | undefined
): boolean {
  return Boolean(role);
}
