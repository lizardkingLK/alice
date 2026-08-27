/**
 * Map service Error messages to HTTP status for integration / RBAC routes.
 * - Unauthorized… → 403
 * - …not found… → 404
 * - else → 500 (or `fallback`)
 */
export function httpStatusFromErrorMessage(
  message: string,
  fallback = 500
): number {
  if (message.startsWith('Unauthorized')) {
    return 403;
  }
  if (/not found/i.test(message)) {
    return 404;
  }
  return fallback;
}

export function jsonErrorFromCaught(
  error: unknown,
  fallbackMessage: string
): { status: number; error: string } {
  const message = error instanceof Error ? error.message : fallbackMessage;
  return {
    status: httpStatusFromErrorMessage(message),
    error: message,
  };
}
