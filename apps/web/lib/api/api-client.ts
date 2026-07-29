import { getResponse } from '@/lib/api/api';
import { createClient } from '@/lib/supabase/client';
import { redirect } from 'next/navigation';
import { buildLoginPath } from '@/lib/auth-redirect';

export async function apiFetch<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    const nextPath =
      typeof globalThis.location !== 'undefined'
        ? `${globalThis.location.pathname}${globalThis.location.search}`
        : null;
    redirect(buildLoginPath(nextPath));
  }

  const token = session.access_token;

  const response = await getResponse(path, token, init);

  return response as T;
}
