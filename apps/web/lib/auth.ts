import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';

export const getUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return null;
  }

  // Check if user is active in the application database
  const { data: dbUser } = await supabase
    .from('users')
    .select('active')
    .eq('email', user.email)
    .single();

  if (dbUser && !dbUser.active) {
    return null;
  }

  return user;
});

export const getDbUser = cache(async () => {
  const user = await getUser();
  if (!user?.email) {
    return null;
  }

  const supabase = await createClient();
  const { data: dbUser } = await supabase
    .from('users')
    .select()
    .eq('email', user.email)
    .single();

  return dbUser;
});

export const getUserRole = cache(async () => {
  const dbUser = await getDbUser();
  return dbUser?.role ?? null;
});
