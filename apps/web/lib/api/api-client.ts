import { getAPIUrl } from '@/lib/api/api-url';
import { createClient } from '@/lib/supabase/client';

type ApiErrorResponse = {
  error: unknown;
};

async function getAccessToken(): Promise<string> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('You must be signed in to perform this action.');
  }

  return session.access_token;
}

function getApiErrorMessage(data: unknown): string {
  if (typeof data !== 'object' || data === null || !('error' in data)) {
    return 'Request failed. Please try again.';
  }

  const { error } = data;

  return typeof error === 'string'
    ? error
    : 'Request failed. Please try again.';
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const token = await getAccessToken();

  const response = await fetch(`${getAPIUrl()}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...init?.headers,
    },
  } as RequestInit);

  const data: T | ApiErrorResponse = await response.json();

  if (!response.ok) {
    const message = getApiErrorMessage(data);
    throw new Error(message);
  }

  return data as T;
}
