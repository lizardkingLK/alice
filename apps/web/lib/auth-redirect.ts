import { headers } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Resolves a safe relative redirect path from the `next` query param.
 * Rejects absolute URLs and protocol-relative paths to prevent open redirects.
 */
export function resolveSafeRedirectPath(
  next: string | null,
  fallback = '/dashboard'
): string {
  if (!next || !next.startsWith('/') || next.startsWith('//')) {
    return fallback;
  }

  return next;
}

import { getOptionalSiteUrl } from '@/lib/env';

/**
 * Resolves the request origin for Supabase redirectTo URLs.
 * Prefers NEXT_PUBLIC_SITE_URL when set, otherwise the request Origin header.
 */
export function resolveRequestOrigin(requestOrigin: string): string {
  const siteUrl = getOptionalSiteUrl();
  if (siteUrl) {
    return siteUrl.replace(/\/$/, '');
  }

  return requestOrigin;
}

/**
 * Reads request headers and returns the origin used in Supabase email links.
 */
export async function getAuthOrigin(): Promise<string> {
  const headersList = await headers();
  const requestOrigin = headersList.get('origin') ?? 'http://localhost:3000';
  return resolveRequestOrigin(requestOrigin);
}

/**
 * Builds the Supabase auth callback URL for email links (signup, reset, invite).
 */
export function buildAuthCallbackUrl(origin: string, next: string): string {
  const safeNext = resolveSafeRedirectPath(next);
  return `${origin}/auth/callback?next=${encodeURIComponent(safeNext)}`;
}

/**
 * Redirects stray PKCE `code` params to the auth callback handler.
 * Supabase falls back to Site URL when redirectTo is missing or rejected,
 * which often lands users on `/` instead of `/auth/callback`.
 */
export function redirectAuthCodeToCallback(
  request: NextRequest
): NextResponse | null {
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
