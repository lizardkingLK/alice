import { headers } from 'next/headers';
import { getOptionalSiteUrl } from '@/lib/env/env';

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
 * Current request path (+ search) for login `next`, when middleware stamped it.
 */
export async function getRequestPathForLoginNext(): Promise<string | null> {
  const headersList = await headers();
  const pathname = headersList.get('x-pathname');
  if (!pathname?.startsWith('/')) {
    return null;
  }
  const search = headersList.get('x-search') ?? '';
  return `${pathname}${search}`;
}

/**
 * Reads request headers and returns the origin used in Supabase email links.
 */
export async function getAuthOrigin(): Promise<string> {
  const headersList = await headers();
  const requestOrigin = headersList.get('origin') ?? 'http://localhost:3000';
  return resolveRequestOrigin(requestOrigin);
}
