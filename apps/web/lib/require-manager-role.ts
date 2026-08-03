import {
  requireManagerOrAdmin,
  type RolePermissionResult,
} from '@/lib/rbac/require-role';

export type ManagePermissionResult = RolePermissionResult;

/** Auth gate for admin/manager-only server mutations. */
export async function requireManagerRole(
  unauthorizedMessage: string
): Promise<ManagePermissionResult> {
  return requireManagerOrAdmin(unauthorizedMessage);
}
