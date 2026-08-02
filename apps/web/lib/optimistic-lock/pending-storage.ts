import {
  OPTIMISTIC_PENDING_INTERVAL_MS,
  type OptimisticLockEntityType,
  type OptimisticPendingPayload,
} from '@repo/types';
import {
  getLocalStorageJson,
  removeLocalStorageItem,
  setLocalStorageJson,
} from '@/lib/local-storage';

export { OPTIMISTIC_PENDING_INTERVAL_MS };

export function optimisticPendingStorageKey(
  entityType: OptimisticLockEntityType,
  entityId: string,
  userId: string
): string {
  return `alice:optimistic-pending:${entityType}:${entityId}:${userId}`;
}

export function readOptimisticPending(
  entityType: OptimisticLockEntityType,
  entityId: string,
  userId: string
): OptimisticPendingPayload | null {
  const key = optimisticPendingStorageKey(entityType, entityId, userId);
  const parsed = getLocalStorageJson<OptimisticPendingPayload>(key);
  if (!parsed) {
    return null;
  }

  if (
    parsed.entityType !== entityType ||
    parsed.entityId !== entityId ||
    parsed.userId !== userId ||
    typeof parsed.baseUpdatedAt !== 'string' ||
    typeof parsed.pendingFields !== 'object' ||
    parsed.pendingFields === null
  ) {
    removeLocalStorageItem(key);
    return null;
  }

  return parsed;
}

export function writeOptimisticPending(
  payload: OptimisticPendingPayload
): boolean {
  const key = optimisticPendingStorageKey(
    payload.entityType,
    payload.entityId,
    payload.userId
  );
  return setLocalStorageJson(key, {
    ...payload,
    savedAt: new Date().toISOString(),
  } satisfies OptimisticPendingPayload);
}

export function clearOptimisticPending(
  entityType: OptimisticLockEntityType,
  entityId: string,
  userId: string
): boolean {
  return removeLocalStorageItem(
    optimisticPendingStorageKey(entityType, entityId, userId)
  );
}

/** Merge dirty fields into an existing pending snapshot (or create one). */
export function upsertOptimisticPendingFields(options: {
  readonly entityType: OptimisticLockEntityType;
  readonly entityId: string;
  readonly userId: string;
  readonly baseUpdatedAt: string;
  readonly pendingFields: Record<string, unknown>;
}): OptimisticPendingPayload {
  const existing = readOptimisticPending(
    options.entityType,
    options.entityId,
    options.userId
  );

  const payload: OptimisticPendingPayload = {
    entityType: options.entityType,
    entityId: options.entityId,
    userId: options.userId,
    baseUpdatedAt: existing?.baseUpdatedAt ?? options.baseUpdatedAt,
    pendingFields: {
      ...(existing?.pendingFields ?? {}),
      ...options.pendingFields,
    },
    savedAt: new Date().toISOString(),
  };

  writeOptimisticPending(payload);
  return payload;
}
