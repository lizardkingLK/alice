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

/**
 * After Prisma `updateMany` with `id` + `updated_at`, resolve the row or a 409.
 * `fetchUpdated` / `fetchCurrent` may still use supabase-js for joined DTOs.
 */
export async function resolveOptimisticPrismaUpdate<T>(options: {
  readonly count: number;
  readonly fetchUpdated: () => Promise<T | null>;
  readonly fetchCurrent: () => Promise<T | null>;
  readonly notFoundMessage?: string;
}): Promise<T> {
  const {
    count,
    fetchUpdated,
    fetchCurrent,
    notFoundMessage = 'Record not found',
  } = options;

  if (count > 0) {
    const updated = await fetchUpdated();
    if (updated) {
      return updated;
    }
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
  json?: (body: Record<string, unknown>) => unknown;
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

/**
 * Send 409 for optimistic-lock conflicts, otherwise 500 with the error message.
 */
export function sendRouteMutationError(
  res: JsonResponder,
  error: unknown,
  fallbackMessage: string
): void {
  if (trySendOptimisticLockError(res, error)) {
    return;
  }
  const message = error instanceof Error ? error.message : fallbackMessage;
  res.status(500).json({ error: message });
}

type LockActionBody = {
  readonly expectedUpdatedAt: string;
};

type LockActionParseResult =
  | { readonly success: true; readonly data: LockActionBody }
  | { readonly success: false; readonly error: unknown };

type LockedStatusRouteOptions<TRecord> = {
  readonly res: JsonResponder;
  readonly actorId: string;
  readonly id: string | undefined;
  readonly missingIdMessage: string;
  readonly parseBody: () => LockActionParseResult;
  readonly treeifyError: (error: unknown) => unknown;
  readonly action: (
    actorId: string,
    id: string,
    expectedUpdatedAt: string
  ) => Promise<TRecord>;
  readonly toResponseBody: (record: TRecord) => Record<string, unknown>;
  readonly failureMessage: string;
};

/**
 * Shared soft-delete / restore handler: parse id + lock body, run action, map JSON.
 */
export async function runLockedStatusRoute<TRecord>(
  options: LockedStatusRouteOptions<TRecord>
): Promise<unknown> {
  if (!options.id) {
    return options.res.status(400).json({ error: options.missingIdMessage });
  }

  const parsed = options.parseBody();
  if (!parsed.success) {
    return options.res
      .status(400)
      .json({ error: options.treeifyError(parsed.error) });
  }

  try {
    const record = await options.action(
      options.actorId,
      options.id,
      parsed.data.expectedUpdatedAt
    );
    return options.res.status(200).json(options.toResponseBody(record));
  } catch (error) {
    sendRouteMutationError(options.res, error, options.failureMessage);
    return undefined;
  }
}
