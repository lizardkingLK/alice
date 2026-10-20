import { toast } from '@repo/ui/components/ui/sonner';
import { OPTIMISTIC_LOCK_ERROR_CODE } from '@repo/types';
import type { DbWorkItem } from '@/app/work-items/_services/work-items.reads.server';
import { ApiError } from '@/lib/api/api-fetch.helper';

export const BOARD_MOVE_CONFLICT_TITLE = 'Someone else moved this item';

/** Toast for DnD / placement optimistic-lock conflicts (board, calendar, backlog). */
export function toastWorkItemDnDConflict(
  title: string,
  description: string
): void {
  toast.message(title, { description });
}

export function toastBoardMoveConflict(
  description = 'The board was updated to the latest placement.'
): void {
  toastWorkItemDnDConflict(BOARD_MOVE_CONFLICT_TITLE, description);
}

export function isBoardMoveOptimisticLockError(
  error: unknown
): error is ApiError {
  return (
    error instanceof ApiError &&
    (error.code === OPTIMISTIC_LOCK_ERROR_CODE || error.status === 409)
  );
}

/** Placement fields from a 409 `serverEntity` when present. */
export function readBoardMoveConflictServerRow(
  error: unknown
): (Partial<DbWorkItem> & { id: string }) | null {
  if (!isBoardMoveOptimisticLockError(error)) {
    return null;
  }
  const entity = error.serverEntity;
  if (!entity || typeof entity !== 'object' || Array.isArray(entity)) {
    return null;
  }
  const record = entity as Record<string, unknown>;
  if (typeof record.id !== 'string' || !record.id) {
    return null;
  }
  return record as Partial<DbWorkItem> & { id: string };
}
