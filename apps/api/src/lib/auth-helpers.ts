import { type UserRole, type Database } from '@repo/types';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from './supabase';

export async function requireUserWithRole(
  actorId: string,
  allowedRoles: UserRole[],
  errorMessage: string
) {
  const { data: user, error } = await supabase
    .from('users')
    .select('role, email')
    .eq('id', actorId)
    .single();

  if (error || !user) {
    throw new Error('Not authenticated.');
  }

  if (!allowedRoles.includes(user.role as UserRole)) {
    throw new Error(errorMessage);
  }
  return user;
}

export async function listAccessibleProjectIdsHelper(
  db: SupabaseClient<Database>,
  actorId: string
): Promise<'all' | string[]> {
  const { data: systemUser } = await db
    .from('users')
    .select('role')
    .eq('id', actorId)
    .maybeSingle();

  if (systemUser?.role === 'admin') {
    return 'all';
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
      'error. failed to list member projects for projects access:',
      memberError.message
    );
    throw new Error('Failed to authorize projects access');
  }

  if (ownedError) {
    console.error(
      'error. failed to list owned projects for projects access:',
      ownedError.message
    );
    throw new Error('Failed to authorize projects access');
  }

  const ids = [
    ...(memberships ?? []).map((row) => row.project_id),
    ...(owned ?? []).map((row) => row.id),
  ];
  return [...new Set(ids)];
}
