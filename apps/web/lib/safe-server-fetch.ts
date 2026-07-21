/**
 * Run a server-side fetch and fall back on failure so a single failed
 * request never blanks the whole page. Keeps `Promise.all` reads in RSC
 * resilient without repeating the same try/catch in every page.
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
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`error. failed to ${label}:`, message);
    return fallback;
  }
}
