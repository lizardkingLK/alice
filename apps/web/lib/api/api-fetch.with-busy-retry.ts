import {
  DATABASE_BUSY_CODE,
  DATABASE_BUSY_HTTP_STATUS,
  DATABASE_BUSY_RETRY_TOAST,
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

/**
 * Retry wrapper for client (and shared) API calls when the backend reports
 * pool / transaction-start pressure (alice#562).
 */
export async function withApiBusyRetry<T>(
  operation: () => Promise<T>,
  options: WithApiBusyRetryOptions = {}
): Promise<T> {
  const maxRetries = options.maxRetries ?? 2;
  const baseDelayMs = options.baseDelayMs ?? 400;
  let attempt = 0;

  for (;;) {
    try {
      return await operation();
    } catch (error) {
      if (!isDatabaseBusyApiError(error) || attempt >= maxRetries) {
        throw error;
      }
      attempt += 1;
      options.onRetry?.(attempt);
      await sleep(baseDelayMs * 2 ** (attempt - 1));
    }
  }
}

export { DATABASE_BUSY_RETRY_TOAST };
