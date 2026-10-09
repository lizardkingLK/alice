/** Stable API error code when Prisma cannot start a transaction (pool busy). */
export const DATABASE_BUSY_CODE = 'DATABASE_BUSY' as const;

/** HTTP status for exhausted / reported database-busy failures. */
export const DATABASE_BUSY_HTTP_STATUS = 503 as const;

export const DATABASE_BUSY_USER_MESSAGE =
  'Database is busy. Please try again in a moment.' as const;

export const DATABASE_BUSY_RETRY_TOAST = 'Database is busy. Retrying…' as const;

/**
 * Detect Prisma / adapter-pg transaction start timeouts and our stable code.
 * See https://github.com/lizardkingLK/alice/issues/562
 */
export function isDatabaseBusyError(error: unknown): boolean {
  if (error == null) {
    return false;
  }

  if (typeof error === 'object') {
    const record = error as {
      code?: unknown;
      message?: unknown;
      name?: unknown;
    };
    if (record.code === DATABASE_BUSY_CODE || record.code === 'P2028') {
      return true;
    }
    if (
      typeof record.message === 'string' &&
      isDatabaseBusyMessage(record.message)
    ) {
      return true;
    }
  }

  if (typeof error === 'string') {
    return isDatabaseBusyMessage(error);
  }

  return false;
}

export function isDatabaseBusyMessage(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes('unable to start a transaction in the given time') ||
    normalized.includes('transaction api error') ||
    normalized.includes(
      'timed out fetching a new connection from the connection pool'
    ) ||
    normalized.includes(DATABASE_BUSY_USER_MESSAGE.toLowerCase()) ||
    normalized.includes('database is busy')
  );
}
