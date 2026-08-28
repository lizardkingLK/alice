import { getActiveMemberProjectIds } from '@/app/board/_services/board.reads.defaults.server';
import { isAdmin, isAppRole } from '@/lib/rbac/roles';
import { createClient } from '@/lib/supabase/server';

/** True when `userId` owns the project (`projects.owner_id`). */
export async function isProjectOwner(
  userId: string,
  projectId: string
): Promise<boolean> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .eq('owner_id', userId)
      .maybeSingle();

    if (error) {
      console.error('error. failed to check project ownership:', error.message);
      return false;
    }

    return Boolean(data?.id);
  } catch (ownershipError) {
    console.error('error. failed to check project ownership', ownershipError);
    return false;
  }
}

/** Active `project_members` project ids for the user; empty on failure. */
export async function listMemberProjectIdsSafe(
  userId: string
): Promise<string[]> {
  try {
    return await getActiveMemberProjectIds(userId);
  } catch (membershipError) {
    console.error(
      'error. failed to list member projects for workspace auth',
      membershipError
    );
    return [];
  }
}

export async function isActiveProjectMember(
  userId: string,
  projectId: string
): Promise<boolean> {
  const memberProjectIds = await listMemberProjectIdsSafe(userId);
  return memberProjectIds.includes(projectId);
}

/**
 * Who may open `/projects/[id]` workspace (all tabs):
 * admin, project owner, or active project member.
 */
export async function canAccessProjectWorkspace(
  userId: string,
  role: string | null | undefined,
  projectId: string
): Promise<boolean> {
  if (!userId || !projectId) {
    return false;
  }

  if (isAppRole(role) && isAdmin(role)) {
    return true;
  }

  if (await isProjectOwner(userId, projectId)) {
    return true;
  }

  return isActiveProjectMember(userId, projectId);
}

/**
 * Project ids visible in the `/projects` registry for this user.
 * - `'all'` — admins see every project
 * - `string[]` — owners ∪ active members (may be empty)
 */
export async function listAccessibleProjectIds(
  userId: string,
  role: string | null | undefined
): Promise<'all' | string[]> {
  if (!userId) {
    return [];
  }

  if (isAppRole(role) && isAdmin(role)) {
    return 'all';
  }

  const memberIds = await listMemberProjectIdsSafe(userId);

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('projects')
      .select('id')
      .eq('owner_id', userId);

    if (error) {
      console.error(
        'error. failed to list owned projects for registry:',
        error.message
      );
      return [...new Set(memberIds)];
    }

    const ownedIds = (data ?? []).map((row) => row.id);
    return [...new Set([...memberIds, ...ownedIds])];
  } catch (ownedError) {
    console.error(
      'error. failed to list owned projects for registry',
      ownedError
    );
    return [...new Set(memberIds)];
  }
}
