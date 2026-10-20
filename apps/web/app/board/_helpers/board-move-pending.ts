import type { DbWorkItem } from '@/app/work-items/_services/work-items.reads.server';

export type BoardMovePendingAttempt = {
  readonly attemptId: string;
  readonly workItemId: string;
  readonly previousStatus: DbWorkItem['status'];
  readonly previousBoardColumnId: string | null;
  readonly previousUpdatedAt: string;
  readonly targetStatus: DbWorkItem['status'];
  readonly targetBoardColumnId: string | null;
};

export function createBoardMoveAttemptId(): string {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID();
  }
  return `attempt-${Date.now()}`;
}

export function upsertPendingAttempt(
  previous: ReadonlyMap<string, BoardMovePendingAttempt>,
  attempt: BoardMovePendingAttempt
): Map<string, BoardMovePendingAttempt> {
  const next = new Map(previous);
  next.set(attempt.workItemId, attempt);
  return next;
}

export function clearPendingAttempt(
  previous: ReadonlyMap<string, BoardMovePendingAttempt>,
  workItemId: string,
  attemptId?: string
): Map<string, BoardMovePendingAttempt> {
  const current = previous.get(workItemId);
  if (!current) {
    return previous instanceof Map ? previous : new Map(previous);
  }
  if (attemptId && current.attemptId !== attemptId) {
    return previous instanceof Map ? previous : new Map(previous);
  }
  const next = new Map(previous);
  next.delete(workItemId);
  return next;
}

/** True when `candidate` is strictly newer than `current` (ISO timestamps). */
export function isNewerUpdatedAt(
  candidate: string | null | undefined,
  current: string | null | undefined
): boolean {
  if (!candidate?.trim()) {
    return false;
  }
  if (!current?.trim()) {
    return true;
  }
  const candidateMs = Date.parse(candidate);
  const currentMs = Date.parse(current);
  if (Number.isNaN(candidateMs) || Number.isNaN(currentMs)) {
    return candidate > current;
  }
  return candidateMs > currentMs;
}

/**
 * Merge a realtime / conflict row into local state. Keeps embeds when the
 * wire row is a flat table payload.
 */
export function mergeBoardPlacementRow(
  current: DbWorkItem,
  row: Partial<DbWorkItem> & { readonly id?: string }
): DbWorkItem {
  const nextUpdatedAt =
    typeof row.updated_at === 'string' && row.updated_at.trim()
      ? row.updated_at
      : current.updated_at;

  return {
    ...current,
    status: (row.status as DbWorkItem['status'] | undefined) ?? current.status,
    board_column_id:
      row.board_column_id !== undefined
        ? row.board_column_id
        : current.board_column_id,
    updated_at: nextUpdatedAt,
    updated_by:
      row.updated_by !== undefined ? row.updated_by : current.updated_by,
    state: row.state !== undefined ? row.state : current.state,
    assignee: row.assignee ?? current.assignee,
    reporter: row.reporter ?? current.reporter,
  };
}
