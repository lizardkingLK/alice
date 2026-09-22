import {
  getResponse,
  ApiError,
  type GetResponseInit,
} from '@/lib/api/api-fetch.helper';
import { createClient } from '@/lib/supabase/client';
import { buildLoginPath } from '@/lib/auth-redirect';
import {
  SessionExpiredError,
  emitSessionExpired,
} from '@/lib/errors/session-expired';

function currentPathForLoginNext(): string | null {
  if (globalThis.location === undefined) {
    return null;
  }
  return `${globalThis.location.pathname}${globalThis.location.search}`;
}

function throwSessionExpired(): never {
  const loginPath = buildLoginPath(currentPathForLoginNext());
  emitSessionExpired(loginPath);
  throw new SessionExpiredError(loginPath);
}

/** Authenticated `'use client'` → Express fetch (shared by reads/mutations use-client entrypoints). */
export async function apiFetch<T>(
  path: string,
  init?: GetResponseInit
): Promise<T> {
  const supabase = createClient();
  let {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    const refreshed = await supabase.auth.refreshSession();
    session = refreshed.data.session;
  }

  if (!session?.access_token) {
    throwSessionExpired();
  }

  const token = session.access_token;

  try {
    return await getResponse(path, token, init);
  } catch (error) {
    // Expired JWT often still sits in getSession(); API then returns 401.
    if (!(error instanceof ApiError) || error.status !== 401) {
      throw error;
    }

    const refreshed = await supabase.auth.refreshSession();
    const nextToken = refreshed.data.session?.access_token;
    if (!nextToken) {
      throwSessionExpired();
    }

    try {
      return await getResponse(path, nextToken, init);
    } catch (retryError) {
      if (retryError instanceof ApiError && retryError.status === 401) {
        throwSessionExpired();
      }
      throw retryError;
    }
  }
}
