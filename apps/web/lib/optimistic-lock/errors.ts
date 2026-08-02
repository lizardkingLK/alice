import {
  OPTIMISTIC_LOCK_ERROR_CODE,
  OPTIMISTIC_LOCK_HTTP_STATUS,
  isOptimisticLockConflictBody,
  type OptimisticLockEntityType,
} from '@repo/types';
import { ApiError } from '@/lib/api/api';

export class OptimisticLockClientError<TServer = unknown> extends ApiError {
  readonly code = OPTIMISTIC_LOCK_ERROR_CODE;
  readonly serverEntity: TServer;
  readonly entityType: OptimisticLockEntityType;
  readonly entityId: string;
  readonly pendingFields: Record<string, unknown>;
  readonly baseUpdatedAt: string;

  constructor(options: {
    readonly message: string;
    readonly serverEntity: TServer;
    readonly entityType: OptimisticLockEntityType;
    readonly entityId: string;
    readonly pendingFields: Record<string, unknown>;
    readonly baseUpdatedAt: string;
  }) {
    super(options.message, OPTIMISTIC_LOCK_HTTP_STATUS);
    this.name = 'OptimisticLockClientError';
    this.serverEntity = options.serverEntity;
    this.entityType = options.entityType;
    this.entityId = options.entityId;
    this.pendingFields = options.pendingFields;
    this.baseUpdatedAt = options.baseUpdatedAt;
  }
}

export function isOptimisticLockClientError(
  error: unknown
): error is OptimisticLockClientError {
  return error instanceof OptimisticLockClientError;
}

export function parseOptimisticLockFromApiError(
  error: unknown,
  context: {
    readonly entityType: OptimisticLockEntityType;
    readonly entityId: string;
    readonly pendingFields: Record<string, unknown>;
    readonly baseUpdatedAt: string;
  }
): OptimisticLockClientError | null {
  if (
    !(error instanceof ApiError) ||
    error.status !== OPTIMISTIC_LOCK_HTTP_STATUS
  ) {
    return null;
  }

  const isLockConflict =
    error.code === OPTIMISTIC_LOCK_ERROR_CODE ||
    error.serverEntity !== undefined;
  if (!isLockConflict) {
    return null;
  }

  return new OptimisticLockClientError({
    message: error.message,
    serverEntity: error.serverEntity ?? null,
    ...context,
  });
}

export function optimisticLockErrorFromResponseBody(
  body: unknown,
  context: {
    readonly entityType: OptimisticLockEntityType;
    readonly entityId: string;
    readonly pendingFields: Record<string, unknown>;
    readonly baseUpdatedAt: string;
  }
): OptimisticLockClientError | null {
  if (!isOptimisticLockConflictBody(body)) {
    return null;
  }

  return new OptimisticLockClientError({
    message: body.error,
    serverEntity: body.serverEntity,
    ...context,
  });
}
