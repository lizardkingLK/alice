import { createClient } from '@/lib/supabase/server';

export async function getUserList() {
  const supabase = await createClient();

  const { data: usersData, error: usersError } = await supabase
    .from('users')
    .select(
      'id, name, email, active, role, status, profile_picture, created_by, created_at, updated_by, updated_at'
    )
    .eq('active', true)
    .order('name', { ascending: true });

  if (usersError) {
    console.error(
      'error. supabase database error fetching users:',
      usersError.message
    );
  }

  return usersData ?? [];
}
