import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';

/** One Auth `getUser()` per RSC request. */
const getAuthUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user ?? null;
});

/** One `public.users` select per RSC request (raw row, including inactive). */
const getDbUserRow = cache(async () => {
  const user = await getAuthUser();
  if (!user?.email) {
    return null;
  }

  const supabase = await createClient();
  const { data: dbUser } = await supabase
    .from('users')
    .select()
    .eq('email', user.email)
    .maybeSingle();

  return dbUser;
});

/**
 * Application profile from `public.users`.
 * Returns null when unsigned-in or when a profile exists and is inactive.
 * Missing profile returns null (caller may treat as unsigned / incomplete).
 */
export const getDbUser = cache(async () => {
  const dbUser = await getDbUserRow();
  if (!dbUser?.active) {
    return null;
  }

  return dbUser;
});

/**
 * Supabase Auth user for the session.
 * Returns null when unsigned-in, or when a `public.users` row exists and is inactive.
 * Reuses the same Auth + DB lookups as `getDbUser` within a request.
 */
export const getUser = cache(async () => {
  const user = await getAuthUser();
  if (!user?.email) {
    return null;
  }

  const dbUser = await getDbUserRow();
  if (dbUser && !dbUser.active) {
    return null;
  }

  return user;
});

export const getUserRole = cache(async () => {
  const dbUser = await getDbUser();
  return dbUser?.role ?? null;
});
