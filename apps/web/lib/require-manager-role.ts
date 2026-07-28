import { getDbUser } from '@/lib/auth';
import type { Tables } from '@repo/types';

export type ManagePermissionResult =
  | { allowed: true; currentUser: Tables<'users'> }
  | { allowed: false; error: string };

/** Auth gate for admin/manager-only server mutations. */
export async function requireManagerRole(
  unauthorizedMessage: string
): Promise<ManagePermissionResult> {
  const currentUser = await getDbUser();
  if (!currentUser) {
    return { allowed: false, error: 'Not authenticated.' };
  }

  if (currentUser.role !== 'admin' && currentUser.role !== 'manager') {
    return {
      allowed: false,
      error: unauthorizedMessage,
    };
  }

  return { allowed: true, currentUser };
}
