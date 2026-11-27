import {
  databaseBusyJsonError,
  isDatabaseBusyError,
  isPrismaClientError,
} from './prisma-errors';

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
  if (message.startsWith('Invalid integration configuration.')) {
    return 400;
  }
  if (
    /^(Cannot |Only |You already|Unknown chat)/.test(message) ||
    message.startsWith('At least one field is required')
  ) {
    return 400;
  }
  return fallback;
}

export function jsonErrorFromCaught(
  error: unknown,
  fallbackMessage: string
): { status: number; error: string; code?: string } {
  if (isDatabaseBusyError(error)) {
    return databaseBusyJsonError();
  }

  // Prisma client errors carry internal DB/schema details (column names,
  // constraint names, raw SQL). Never forward them to the frontend (GI-666).
  if (isPrismaClientError(error)) {
    return { status: 500, error: fallbackMessage };
  }

  const message = error instanceof Error ? error.message : fallbackMessage;
  return {
    status: httpStatusFromErrorMessage(message),
    error: message,
  };
}
