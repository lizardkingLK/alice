import { supabase } from './supabase';

export async function requireUserWithRole(
  actorId: string,
  allowedRoles: ('admin' | 'manager' | 'member')[],
  errorMessage: string
) {
  const { data: user, error } = await supabase
    .from('users')
    .select('role')
    .eq('id', actorId)
    .single();

  if (error || !user) {
    throw new Error('Not authenticated.');
  }

  if (!allowedRoles.includes(user.role as 'admin' | 'manager' | 'member')) {
    throw new Error(errorMessage);
  }
  return user;
}
