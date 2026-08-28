import { type UserRole } from '@repo/types';
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

