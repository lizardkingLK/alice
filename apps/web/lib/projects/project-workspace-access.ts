import { getActiveMemberProjectIds } from '@/app/board/_services/board.reads.defaults.server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import {
  resolveProjectIdsFromAllowlistValue,
  normalizedAllowlistProjectKeysFromValue,
} from '@repo/types';

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
 * project owner, active project member, or email-guest allowlist ACL.
 * All roles (including admin) use the same “my projects” rule.
 */
export async function canAccessProjectWorkspace(
  userId: string,
  projectId: string
): Promise<boolean> {
  if (!userId || !projectId) {
    return false;
  }

  try {
    const guestProjectIds = await resolveAllowedProjectIdsFromAcl(userId);
    if (guestProjectIds !== null) {
      return guestProjectIds.includes(projectId);
    }
  } catch (err) {
    console.error(
      'error. failed to resolve guest workspace access from allowlist',
      err
    );
  }

  if (await isProjectOwner(userId, projectId)) {
    return true;
  }

  return isActiveProjectMember(userId, projectId);
}

async function resolveAllowedProjectIdsFromAcl(
  userId: string
): Promise<string[] | null> {
  // Allowlist is service-role only (RLS hybrid P0). Session client cannot read it.
  const admin = createAdminClient();

  const { data: userRow } = await admin
    .from('users')
    .select('email')
    .eq('id', userId)
    .maybeSingle();

  if (!userRow?.email) {
    return null;
  }

  const { data: allowlistRecord } = await admin
    .from('access_allowlist')
    .select('allowed_project_ids')
    .eq('status', 'active')
    .eq('kind', 'email')
    .eq('value', userRow.email.trim().toLowerCase())
    .maybeSingle();

  if (!allowlistRecord) {
    return null;
  }

  const normalizedKeys = normalizedAllowlistProjectKeysFromValue(
    allowlistRecord.allowed_project_ids
  );
  if (normalizedKeys.length === 0) {
    return [];
  }

  try {
    const { data: matchedProjects } = await admin
      .from('projects')
      .select('id, key')
      .in('key', normalizedKeys);
    return resolveProjectIdsFromAllowlistValue(
      allowlistRecord.allowed_project_ids,
      matchedProjects ?? []
    );
  } catch (err) {
    console.error('Failed to parse allowed_project_ids ACL:', err);
    return [];
  }
}

/**
 * Project ids visible for this user (registry, dropdowns, filters, defaults).
 * Same for every role (“my projects”): owners ∪ active members, or guest
 * allowlist ACL when present. Never returns every project for admins.
 */
export async function listAccessibleProjectIds(
  userId: string
): Promise<string[]> {
  if (!userId) {
    return [];
  }

  const memberIds = await listMemberProjectIdsSafe(userId);
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

    const allowedProjectIdsFromAcl =
      await resolveAllowedProjectIdsFromAcl(userId);
    if (allowedProjectIdsFromAcl !== null) {
      return allowedProjectIdsFromAcl;
    }
  } catch (err) {
    console.error(
      'error. failed to resolve projects for registry with ACL',
      err
    );
  }

  return [...new Set([...memberIds, ...ownedIds])];
}
