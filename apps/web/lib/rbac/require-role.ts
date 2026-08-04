import { redirect } from 'next/navigation';
import { getDbUser } from '@/lib/auth';
import { roleAtLeast, type AppRole } from '@/lib/rbac/roles';
import type { Tables } from '@repo/types';

export type RolePermissionResult =
  | { allowed: true; currentUser: Tables<'users'> }
  | { allowed: false; error: string };

const DEFAULT_DENIED_HOME = '/dashboard';

/**
 * Soft authz check for Server Actions / mutations.
 * Returns a result object — never throws for expected denials.
 */
export async function requireRole(
  minimum: AppRole,
  unauthorizedMessage: string
): Promise<RolePermissionResult> {
  const currentUser = await getDbUser();
  if (!currentUser) {
    return { allowed: false, error: 'Not authenticated.' };
  }

  if (!roleAtLeast(currentUser.role, minimum)) {
    console.warn(
      'warn. rbac denied:',
      `user=${currentUser.id} role=${currentUser.role} required=${minimum}`
    );
    return { allowed: false, error: unauthorizedMessage };
  }

  return { allowed: true, currentUser };
}

export async function requireAdmin(
  unauthorizedMessage = 'Unauthorized. Only admins can perform this action.'
): Promise<RolePermissionResult> {
  return requireRole('admin', unauthorizedMessage);
}

export async function requireManagerOrAdmin(
  unauthorizedMessage = 'Unauthorized. Only admins and managers can perform this action.'
): Promise<RolePermissionResult> {
  return requireRole('manager', unauthorizedMessage);
}

/**
 * Hard gate for RSC layouts/pages: redirect when the user lacks the role.
 * Prefer this over throwing so production does not show digest-only errors.
 */
export async function assertRoleOrRedirect(
  minimum: AppRole,
  options?: {
    readonly deniedHome?: string;
  }
): Promise<Tables<'users'>> {
  const currentUser = await getDbUser();
  const deniedHome = options?.deniedHome ?? DEFAULT_DENIED_HOME;

  if (!currentUser) {
    redirect('/login');
  }

  if (!roleAtLeast(currentUser.role, minimum)) {
    console.warn(
      'warn. rbac redirect:',
      `user=${currentUser.id} role=${currentUser.role} required=${minimum} -> ${deniedHome}`
    );
    redirect(deniedHome);
  }

  return currentUser;
}

export async function assertAdminOrRedirect(options?: {
  readonly deniedHome?: string;
}): Promise<Tables<'users'>> {
  return assertRoleOrRedirect('admin', options);
}

export async function assertManagerOrRedirect(options?: {
  readonly deniedHome?: string;
}): Promise<Tables<'users'>> {
  return assertRoleOrRedirect('manager', options);
}
