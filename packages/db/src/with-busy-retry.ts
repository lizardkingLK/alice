import { DATABASE_BUSY_USER_MESSAGE, isDatabaseBusyError } from '@repo/types';

export type WithBusyRetryOptions = {
  /** Total attempts including the first try. Default 3. */
  readonly maxAttempts?: number;
  /** Base delay in ms before retry (doubles each attempt). Default 250. */
  readonly baseDelayMs?: number;
  /** Optional hook when a busy failure will be retried. */
  readonly onRetry?: (attempt: number, error: unknown) => void;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Retry a Prisma (or other) operation when the connection pool cannot start
 * a transaction in time. Aligns with alice#562.
 */
export async function withBusyRetry<T>(
  operation: () => Promise<T>,
  options: WithBusyRetryOptions = {}
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 250;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const canRetry = isDatabaseBusyError(error) && attempt < maxAttempts;
      if (!canRetry) {
        break;
      }
      options.onRetry?.(attempt, error);
      await sleep(baseDelayMs * 2 ** (attempt - 1));
    }
  }

  if (isDatabaseBusyError(lastError)) {
    throw new Error(DATABASE_BUSY_USER_MESSAGE, { cause: lastError });
  }
  throw lastError;
}
