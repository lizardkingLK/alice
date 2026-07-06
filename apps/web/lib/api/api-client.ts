import { getResponse } from '@/lib/api/api';
import { createClient } from '@/lib/supabase/client';

export async function apiFetch<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('You must be signed in to perform this action.');
  }

  const token = session.access_token;

  const response = await getResponse(path, token, init);

  return response as T;
}
