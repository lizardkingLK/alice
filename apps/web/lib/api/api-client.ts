import { getResponse } from '@/lib/api/api';
import { createClient } from '@/lib/supabase/client';
import { redirect } from 'next/navigation';

export async function apiFetch<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    redirect('/login');
  }

  const token = session.access_token;

  const response = await getResponse(path, token, init);

  return response as T;
}
