export {
  APP_ROLES,
  isAdmin,
  isAppRole,
  isManagerOrAdmin,
  roleAtLeast,
  type AppRole,
} from '@/lib/rbac/roles';

export {
  canAccessNavGroup,
  canAccessPath,
  canAccessSystemNav,
  minimumRoleForPath,
  type NavGroupId,
} from '@/lib/rbac/route-policy';

/** Server-only guards live in `@/lib/rbac/require-role` — do not re-export here (client barrel). */
