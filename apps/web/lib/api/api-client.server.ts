import { cache } from 'react';
import { getResponse } from '@/lib/api/api';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

/** One session lookup per RSC request, shared across all `apiFetch` calls. */
const getAccessToken = cache(async (): Promise<string | null> => {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return session?.access_token ?? null;
});

export async function apiFetch<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const token = await getAccessToken();

  if (!token) {
    redirect('/login');
  }

  return getResponse(path, token, init) as Promise<T>;
}
