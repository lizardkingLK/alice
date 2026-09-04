import type { SupabaseClient } from '@supabase/supabase-js';
import {
  type Database,
  RecordStatusEnum,
  resolveProjectIdsFromAllowlistValue,
  normalizedAllowlistProjectKeysFromValue,
} from '@repo/types';
import { AccessAllowlistKind as AccessAllowlistKindEnum } from '@repo/types/prisma';

/** @deprecated Admins no longer receive every project; kept for call-site migrators. */
export const ALL_PROJECTS = 'all';

async function resolveAllowedProjectIdsFromAcl(
  db: SupabaseClient<Database>,
  email: string
): Promise<string[] | null> {
  const { data: allowlistRecord } = await db
    .from('access_allowlist')
    .select('allowed_project_ids')
    .eq('status', RecordStatusEnum.active)
    .eq('kind', AccessAllowlistKindEnum.email)
    .eq('value', email.trim().toLowerCase())
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
    const { data: matchedProjects } = await db
      .from('projects')
      .select('id, key')
      .in('key', normalizedKeys);
    return resolveProjectIdsFromAllowlistValue(
      allowlistRecord.allowed_project_ids,
      matchedProjects ?? []
    );
  } catch (e) {
    console.error('Failed to parse allowed_project_ids ACL:', e);
    return [];
  }
}

/**
 * Project ids the actor may use (registry, lists, mutations).
 * Same for every role (“my projects”): owners ∪ active members, or guest
 * allowlist ACL when present.
 */
export async function listAccessibleProjectIds(
  db: SupabaseClient<Database>,
  actorId: string
): Promise<string[]> {
  const { data: systemUser } = await db
    .from('users')
    .select('email')
    .eq('id', actorId)
    .maybeSingle();

  const [
    { data: memberships, error: memberError },
    { data: owned, error: ownedError },
  ] = await Promise.all([
    db
      .from('project_members')
      .select('project_id')
      .eq('user_id', actorId)
      .eq('status', 'active'),
    db.from('projects').select('id').eq('owner_id', actorId),
  ]);

  if (memberError) {
    console.error(
      'error. failed to list member projects for project access:',
      memberError.message
    );
    throw new Error('Failed to authorize project access');
  }

  if (ownedError) {
    console.error(
      'error. failed to list owned projects for project access:',
      ownedError.message
    );
    throw new Error('Failed to authorize project access');
  }

  let allowedProjectIdsFromAcl: string[] | null = null;
  if (systemUser?.email) {
    allowedProjectIdsFromAcl = await resolveAllowedProjectIdsFromAcl(
      db,
      systemUser.email
    );
  }

  const ids = [
    ...(memberships ?? []).map((row) => row.project_id),
    ...(owned ?? []).map((row) => row.id),
  ];

  if (allowedProjectIdsFromAcl !== null) {
    return allowedProjectIdsFromAcl;
  }

  return [...new Set(ids)];
}
