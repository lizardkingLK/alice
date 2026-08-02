import { z } from 'zod';

/** Stable API / client error code for row-level optimistic lock conflicts. */
export const OPTIMISTIC_LOCK_ERROR_CODE = 'OPTIMISTIC_LOCK' as const;

export const OPTIMISTIC_LOCK_HTTP_STATUS = 409 as const;

export const OPTIMISTIC_PENDING_INTERVAL_MS = 5000 as const;

/** Accepts Postgres/Supabase `timestamptz` strings (`Z` or numeric offsets). */
export const expectedUpdatedAtSchema = z.string().datetime({
  offset: true,
  message: 'expectedUpdatedAt must be an ISO-8601 datetime',
});

export type OptimisticLockEntityType =
  | 'work_item'
  | 'comment'
  | 'project'
  | 'sprint'
  | 'team'
  | 'team_member'
  | 'user'
  | 'access_allowlist'
  | 'attachment';

export type OptimisticLockConflictBody<TServer = unknown> = {
  readonly code: typeof OPTIMISTIC_LOCK_ERROR_CODE;
  readonly error: string;
  readonly serverEntity: TServer;
};

export type OptimisticPendingPayload = {
  readonly entityType: OptimisticLockEntityType;
  readonly entityId: string;
  readonly userId: string;
  readonly baseUpdatedAt: string;
  readonly pendingFields: Record<string, unknown>;
  readonly savedAt: string;
};

export function isOptimisticLockConflictBody(
  value: unknown
): value is OptimisticLockConflictBody {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    record.code === OPTIMISTIC_LOCK_ERROR_CODE &&
    typeof record.error === 'string' &&
    'serverEntity' in record
  );
}
