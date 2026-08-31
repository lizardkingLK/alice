import type { Database } from '@repo/types';
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { isEmailAllowed, isPublicAccessPath } from '@/lib/access-allowlist';
import { buildLoginPath } from '@/lib/auth-redirect';

function copyCookies(from: NextResponse, to: NextResponse): NextResponse {
  from.cookies.getAll().forEach(({ name, value, ...options }) => {
    to.cookies.set(name, value, options);
  });
  return to;
}

function withPathHeaders(request: NextRequest): {
  requestHeaders: Headers;
  response: NextResponse;
} {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-pathname', request.nextUrl.pathname);
  requestHeaders.set('x-search', request.nextUrl.search);
  return {
    requestHeaders,
    response: NextResponse.next({
      request: { headers: requestHeaders },
    }),
  };
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

function redirectToLoginWithNext(
  request: NextRequest,
  sessionResponse: NextResponse
): NextResponse {
  const nextPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  const loginPath = buildLoginPath(nextPath);
  const url = new URL(loginPath, request.nextUrl.origin);
  return copyCookies(sessionResponse, NextResponse.redirect(url));
}

/**
 * Redirects stray PKCE `code` params to the auth callback handler.
 * Supabase falls back to Site URL when redirectTo is missing or rejected,
 * which often lands users on `/` instead of `/auth/callback`.
 */
function redirectAuthCodeToCallback(request: NextRequest): NextResponse | null {
  const code = request.nextUrl.searchParams.get('code');
  if (!code || request.nextUrl.pathname === '/auth/callback') {
    return null;
  }

  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = '/auth/callback';

  if (!redirectUrl.searchParams.has('next')) {
    redirectUrl.searchParams.set('next', '/dashboard');
  }

  return NextResponse.redirect(redirectUrl);
}

/**
 * For signed-in users on non-public paths, require an allowlisted email.
 * Anonymous traffic on protected paths is redirected to login with `next`.
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
    const allowed = await isEmailAllowed(email ?? '', { enforceGuestChecks: true });
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

  const { response: initialResponse } = withPathHeaders(request);
  let supabaseResponse = initialResponse;

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
        const refreshed = withPathHeaders(request);
        supabaseResponse = refreshed.response;
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    if (!isPublicAccessPath(request.nextUrl.pathname)) {
      return redirectToLoginWithNext(request, supabaseResponse);
    }
    return supabaseResponse;
  }

  const denied = await enforceAllowlistGate(
    request,
    supabaseResponse,
    user.email
  );
  if (denied) {
    return denied;
  }

  return supabaseResponse;
}
