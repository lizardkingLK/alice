/**
 * Resolves a safe relative redirect path from the `next` query param.
 * Rejects absolute URLs and protocol-relative paths to prevent open redirects.
 */
export function resolveSafeRedirectPath(
  next: string | null | undefined,
  fallback = '/dashboard'
): string {
  if (!next || !next.startsWith('/') || next.startsWith('//')) {
    return fallback;
  }

  const pathOnly = next.split('?')[0] ?? next;
  if (
    pathOnly === '/login' ||
    pathOnly === '/signup' ||
    pathOnly === '/forgot-password' ||
    pathOnly === '/access-denied'
  ) {
    return fallback;
  }

  return next;
}

/**
 * Builds `/login?next=…` so post-auth can return the user to their destination.
 */
export function buildLoginPath(
  nextPath?: string | null,
  extras?: { readonly error?: string }
): string {
  const params = new URLSearchParams();
  const safeNext = resolveSafeRedirectPath(nextPath, '');
  if (safeNext) {
    params.set('next', safeNext);
  }
  if (extras?.error) {
    params.set('error', extras.error);
  }
  const query = params.toString();
  return query ? `/login?${query}` : '/login';
}

/**
 * Builds the Supabase auth callback URL for email links (signup, reset, invite).
 */
export function buildAuthCallbackUrl(origin: string, next: string): string {
  const safeNext = resolveSafeRedirectPath(next);
  return `${origin}/auth/callback?next=${encodeURIComponent(safeNext)}`;
}
