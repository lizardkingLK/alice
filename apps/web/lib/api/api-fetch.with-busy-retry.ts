import {
  DATABASE_BUSY_CODE,
  DATABASE_BUSY_HTTP_STATUS,
  isDatabaseBusyError,
  isDatabaseBusyMessage,
} from '@repo/types';
import { ApiError } from '@/lib/api/api-fetch.helper';

export type WithApiBusyRetryOptions = {
  /** Extra attempts after the first failure. Default 2. */
  readonly maxRetries?: number;
  /** Base delay in ms before retry (doubles each attempt). Default 400. */
  readonly baseDelayMs?: number;
  /** Called before each retry (e.g. show a toast). */
  // eslint-disable-next-line no-unused-vars -- callback signature
  readonly onRetry?: (attempt: number) => void;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function isDatabaseBusyApiError(error: unknown): boolean {
  if (error instanceof ApiError) {
    if (error.code === DATABASE_BUSY_CODE) {
      return true;
    }
    if (error.status === DATABASE_BUSY_HTTP_STATUS) {
      return isDatabaseBusyMessage(error.message);
    }
    return isDatabaseBusyMessage(error.message);
  }
  return isDatabaseBusyError(error);
}

async function runApiBusyAttempt<T>(
  operation: () => Promise<T>,
  attempt: number,
  maxRetries: number,
  baseDelayMs: number,
  onRetry: WithApiBusyRetryOptions['onRetry']
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (!isDatabaseBusyApiError(error) || attempt >= maxRetries) {
      throw error;
    }
    const nextAttempt = attempt + 1;
    onRetry?.(nextAttempt);
    await sleep(baseDelayMs * 2 ** (nextAttempt - 1));
    return runApiBusyAttempt(
      operation,
      nextAttempt,
      maxRetries,
      baseDelayMs,
      onRetry
    );
  }
}

/**
 * Retry wrapper for client (and shared) API calls when the backend reports
 * pool / transaction-start pressure (alice#562).
 */
export async function withApiBusyRetry<T>(
  operation: () => Promise<T>,
  options: WithApiBusyRetryOptions = {}
): Promise<T> {
  return runApiBusyAttempt(
    operation,
    0,
    options.maxRetries ?? 2,
    options.baseDelayMs ?? 400,
    options.onRetry
  );
}
