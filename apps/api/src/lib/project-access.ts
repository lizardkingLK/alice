import type { SupabaseClient } from '@supabase/supabase-js';
import { UserRoleEnum, type Database } from '@repo/types';

export const ALL_PROJECTS = 'all';

export async function listAccessibleProjectIds(
  db: SupabaseClient<Database>,
  actorId: string
): Promise<typeof ALL_PROJECTS | string[]> {
  const { data: systemUser } = await db
    .from('users')
    .select('role')
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

  const ids = [
    ...(memberships ?? []).map((row) => row.project_id),
    ...(owned ?? []).map((row) => row.id),
  ];
  return [...new Set(ids)];
}
