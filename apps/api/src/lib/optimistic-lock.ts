import {
  OPTIMISTIC_LOCK_ERROR_CODE,
  OPTIMISTIC_LOCK_HTTP_STATUS,
} from '@repo/types';

/**
 * Thrown from repositories/services when a conditional update matched 0 rows
 * because `updated_at` no longer equals the client's expected value.
 */
export class OptimisticLockError<TServer = unknown> extends Error {
  readonly code = OPTIMISTIC_LOCK_ERROR_CODE;
  readonly httpStatus = OPTIMISTIC_LOCK_HTTP_STATUS;
  readonly serverEntity: TServer;

  constructor(
    serverEntity: TServer,
    message = 'This record was updated by someone else.'
  ) {
    super(message);
    this.name = 'OptimisticLockError';
    this.serverEntity = serverEntity;
  }
}

export function isOptimisticLockError(
  error: unknown
): error is OptimisticLockError {
  return error instanceof OptimisticLockError;
}

/**
 * After `.eq('id', …).eq('updated_at', expected).select().maybeSingle()`,
 * resolve success or throw OptimisticLockError with the current row.
 */
export async function resolveOptimisticUpdate<T>(options: {
  readonly data: T | null;
  readonly error: { message: string; code?: string } | null;
  readonly fetchCurrent: () => Promise<T | null>;
  readonly notFoundMessage?: string;
}): Promise<T> {
  const {
    data,
    error,
    fetchCurrent,
    notFoundMessage = 'Record not found',
  } = options;

  if (error) {
    console.error('error. optimistic update failed:', error.message);
    throw new Error(`Failed to update record: ${error.message}`);
  }

  if (data) {
    return data;
  }

  const current = await fetchCurrent();
  if (!current) {
    throw new Error(notFoundMessage);
  }

  throw new OptimisticLockError(current);
}

type JsonResponder = {
  status: (code: number) => {
    json: (body: Record<string, unknown>) => unknown;
  };
};

/** Returns true when the error was handled as a 409 optimistic lock response. */
export function trySendOptimisticLockError(
  res: JsonResponder,
  error: unknown
): boolean {
  if (!isOptimisticLockError(error)) {
    return false;
  }

  res.status(OPTIMISTIC_LOCK_HTTP_STATUS).json({
    code: OPTIMISTIC_LOCK_ERROR_CODE,
    error: error.message,
    serverEntity: error.serverEntity,
  });
  return true;
}
