import type { Database } from '@repo/types';
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import {
  isEmailAllowed,
  isPublicAccessPath,
} from '@/lib/access-allowlist';
import { redirectAuthCodeToCallback } from '@/lib/auth-redirect';

function copyCookies(from: NextResponse, to: NextResponse): NextResponse {
  from.cookies.getAll().forEach(({ name, value, ...options }) => {
    to.cookies.set(name, value, options);
  });
  return to;
}

function redirectPreservingSession(
  request: NextRequest,
  sessionResponse: NextResponse,
  pathname: string
): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = '';
  return copyCookies(sessionResponse, NextResponse.redirect(url));
}

/**
 * For signed-in users on non-public paths, require an allowlisted email.
 * Anonymous traffic is left to page-level auth redirects.
 */
async function enforceAllowlistGate(
  request: NextRequest,
  sessionResponse: NextResponse,
  email: string | undefined
): Promise<NextResponse | null> {
  if (isPublicAccessPath(request.nextUrl.pathname)) {
    return null;
  }

  try {
    const allowed = await isEmailAllowed(email ?? '');
    if (allowed) {
      return null;
    }
  } catch (error) {
    console.error(
      'error. access allowlist middleware check failed:',
      error instanceof Error ? error.message : error
    );
  }

  return redirectPreservingSession(request, sessionResponse, '/access-denied');
}

export async function updateSession(request: NextRequest) {
  const authCodeRedirect = redirectAuthCodeToCallback(request);
  if (authCodeRedirect) {
    return authCodeRedirect;
  }

  let supabaseResponse = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return supabaseResponse;
  }

  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const denied = await enforceAllowlistGate(
      request,
      supabaseResponse,
      user.email
    );
    if (denied) {
      return denied;
    }
  }

  return supabaseResponse;
}
