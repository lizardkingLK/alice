/**
 * Server-only docs visibility — production shows user-guide manifest only.
 * Reuses NODE_ENV (same signal as next.config.js rewrites: dev vs prod).
 */

/** When true, the full repo docs tree is visible in /docs. */
export function isDocsDevMode(): boolean {
  return process.env.NODE_ENV !== 'production';
}
