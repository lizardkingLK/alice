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

async function runBusyAttempt<T>(
  operation: () => Promise<T>,
  attempt: number,
  maxAttempts: number,
  baseDelayMs: number,
  onRetry: WithBusyRetryOptions['onRetry']
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    const canRetry = isDatabaseBusyError(error) && attempt < maxAttempts;
    if (!canRetry) {
      if (isDatabaseBusyError(error)) {
        throw new Error(DATABASE_BUSY_USER_MESSAGE, { cause: error });
      }
      throw error;
    }
    onRetry?.(attempt, error);
    await sleep(baseDelayMs * 2 ** (attempt - 1));
    return runBusyAttempt(
      operation,
      attempt + 1,
      maxAttempts,
      baseDelayMs,
      onRetry
    );
  }
}

/**
 * Retry a Prisma (or other) operation when the connection pool cannot start
 * a transaction in time. Aligns with alice#562.
 */
export async function withBusyRetry<T>(
  operation: () => Promise<T>,
  options: WithBusyRetryOptions = {}
): Promise<T> {
  return runBusyAttempt(
    operation,
    1,
    options.maxAttempts ?? 3,
    options.baseDelayMs ?? 250,
    options.onRetry
  );
}
