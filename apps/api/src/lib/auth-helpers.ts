import { type UserRole } from '@repo/types';
import { supabase } from './supabase';

export async function getActorUser(
  actorId: string
): Promise<{ id: string; role: UserRole; email: string }> {
  const { data: user, error } = await supabase
    .from('users')
    .select('role, email')
    .eq('id', actorId)
    .single();

  if (error || !user) {
    throw new Error('Not authenticated.');
  }

  return {
    id: actorId,
    role: user.role as UserRole,
    email: user.email,
  };
}

export async function requireUserWithRole(
  actorId: string,
  allowedRoles: UserRole[],
  errorMessage: string
) {
  const user = await getActorUser(actorId);

  if (!allowedRoles.includes(user.role)) {
    throw new Error(errorMessage);
  }
  return user;
}

