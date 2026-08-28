import type { SupabaseClient } from '@supabase/supabase-js';
import { UserRoleEnum, type Database, RecordStatusEnum } from '@repo/types';
import { AccessAllowlistKind as AccessAllowlistKindEnum } from '@repo/types/prisma';

export const ALL_PROJECTS = 'all';

export async function listAccessibleProjectIds(
  db: SupabaseClient<Database>,
  actorId: string
): Promise<typeof ALL_PROJECTS | string[]> {
  const { data: systemUser } = await db
    .from('users')
    .select('role, email')
    .eq('id', actorId)
    .maybeSingle();

  if (systemUser?.role === UserRoleEnum.admin) {
    return ALL_PROJECTS;
  }

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
    const { data: allowlistRecord } = await db
      .from('access_allowlist')
      .select('allowed_project_ids')
      .eq('status', RecordStatusEnum.active)
      .eq('kind', AccessAllowlistKindEnum.email)
      .eq('value', systemUser.email.trim().toLowerCase())
      .maybeSingle();

    if (allowlistRecord?.allowed_project_ids) {
      try {
        const acl = allowlistRecord.allowed_project_ids;
        if (Array.isArray(acl)) {
          allowedProjectIdsFromAcl = acl.map(id => String(id));
        }
      } catch (e) {
        console.error('Failed to parse allowed_project_ids ACL:', e);
      }
    }
  }

  let ids = [
    ...(memberships ?? []).map((row) => row.project_id),
    ...(owned ?? []).map((row) => row.id),
  ];

  if (allowedProjectIdsFromAcl !== null) {
    ids = ids.filter(id => allowedProjectIdsFromAcl!.includes(id));
  }

  return [...new Set(ids)];
}
