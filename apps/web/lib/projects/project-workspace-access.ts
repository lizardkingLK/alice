import { getActiveMemberProjectIds } from '@/app/board/_services/board.reads.defaults.server';
import { isAdmin, isAppRole } from '@/lib/rbac/roles';
import { createClient } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@repo/types';

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

async function resolveAllowedProjectIdsFromAcl(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<string[] | null> {
  const { data: userRow } = await supabase
    .from('users')
    .select('email')
    .eq('id', userId)
    .maybeSingle();

  if (!userRow?.email) {
    return null;
  }

  const { data: allowlistRecord } = await supabase
    .from('access_allowlist')
    .select('allowed_project_ids')
    .eq('status', 'active')
    .eq('kind', 'email')
    .eq('value', userRow.email.trim().toLowerCase())
    .maybeSingle();

  if (!allowlistRecord?.allowed_project_ids) {
    return null;
  }

  try {
    const acl = allowlistRecord.allowed_project_ids;
    if (!Array.isArray(acl)) {
      return null;
    }
    const keys = acl
      .map(String)
      .map((k) => k.trim().toUpperCase())
      .filter(Boolean);
    if (keys.length === 0) {
      return [];
    }
    const { data: matchedProjects } = await supabase
      .from('projects')
      .select('id')
      .in('key', keys);
    return (matchedProjects ?? []).map((row) => row.id);
  } catch (err) {
    console.error('Failed to parse allowed_project_ids ACL:', err);
    return null;
  }
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

  let memberIds = await listMemberProjectIdsSafe(userId);
  let ownedIds: string[] = [];

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
    } else {
      ownedIds = (data ?? []).map((row) => row.id);
    }

    const allowedProjectIdsFromAcl = await resolveAllowedProjectIdsFromAcl(
      supabase,
      userId
    );
    if (allowedProjectIdsFromAcl !== null) {
      memberIds = memberIds.filter((id) =>
        allowedProjectIdsFromAcl.includes(id)
      );
      ownedIds = ownedIds.filter((id) => allowedProjectIdsFromAcl.includes(id));
    }
  } catch (err) {
    console.error(
      'error. failed to resolve projects for registry with ACL',
      err
    );
  }

  return [...new Set([...memberIds, ...ownedIds])];
}
