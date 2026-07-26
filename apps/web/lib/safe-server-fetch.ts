import { isBackendUnreachableError } from '@/lib/errors/backend-unreachable';

/**
 * Run a server-side fetch and fall back on failure so a single failed
 * request never blanks the whole page. Keeps `Promise.all` reads in RSC
 * resilient without repeating the same try/catch in every page.
 *
 * Backend connectivity failures are rethrown so the nearest `error.tsx`
 * can show a dashboard-shell recovery UI instead of a silent empty state.
 *
 * The underlying promise is created by the caller, so wrapping it inside
 * `Promise.all([...])` preserves concurrency.
 */
export async function safeServerFetch<T>(
  promise: Promise<T>,
  fallback: T,
  label: string
): Promise<T> {
  try {
    return await promise;
  } catch (error) {
    if (isBackendUnreachableError(error)) {
      throw error;
    }

    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`error. failed to ${label}:`, message);
    return fallback;
  }
}
