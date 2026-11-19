import type { DbWorkItem } from '@/app/work-items/_services/work-items.reads.server';
import { isNewerUpdatedAt } from '@/app/board/_helpers/board-move-pending';

export type WorkItemRealtimeMergeFields =
  | 'status'
  | 'board_column_id'
  | 'due_date'
  | 'sprint_id'
  | 'updated_by'
  | 'state';

/**
 * Merge a realtime / conflict wire row into local state. Keeps embeds when the
 * payload is a flat table row. Only copies keys listed in `fields` (plus
 * `updated_at` when present).
 */
export function mergeWorkItemRealtimeRow(
  current: DbWorkItem,
  row: Partial<DbWorkItem> & { readonly id?: string },
  fields: readonly WorkItemRealtimeMergeFields[]
): DbWorkItem {
  const nextUpdatedAt =
    typeof row.updated_at === 'string' && row.updated_at.trim()
      ? row.updated_at
      : current.updated_at;

  let next: DbWorkItem = {
    ...current,
    updated_at: nextUpdatedAt,
    assignee: row.assignee ?? current.assignee,
    reporter: row.reporter ?? current.reporter,
  };

  for (const field of fields) {
    if (row[field] === undefined) {
      continue;
    }
    switch (field) {
      case 'status':
        next = {
          ...next,
          status: (row.status as DbWorkItem['status']) ?? next.status,
        };
        break;
      case 'board_column_id':
        next = { ...next, board_column_id: row.board_column_id ?? null };
        break;
      case 'due_date':
        next = { ...next, due_date: row.due_date ?? null };
        break;
      case 'sprint_id':
        next = { ...next, sprint_id: row.sprint_id ?? null };
        break;
      case 'updated_by':
        next = { ...next, updated_by: row.updated_by ?? next.updated_by };
        break;
      case 'state':
        next = { ...next, state: row.state ?? next.state };
        break;
      default:
        break;
    }
  }

  return next;
}

export type ApplyRealtimeWorkItemRowOptions = {
  /**
   * When true for a work-item id, skip applying this row (pending optimistic
   * flush owns local placement fields — same idea as comment reactions).
   */
  // eslint-disable-next-line no-unused-vars -- predicate
  isFlushPending?: (workItemId: string) => boolean;
  /**
   * Fields to keep from local state while merging a newer row (partial
   * preserve). Prefer `isFlushPending` for full DnD placement guards.
   */
  preserveFields?: readonly WorkItemRealtimeMergeFields[];
};

/** Apply a newer realtime row into a list; returns null when unchanged. */
export function applyRealtimeWorkItemRow(
  items: readonly DbWorkItem[],
  row: Partial<DbWorkItem> & { id: string },
  fields: readonly WorkItemRealtimeMergeFields[],
  options: ApplyRealtimeWorkItemRowOptions = {}
): DbWorkItem[] | null {
  if (options.isFlushPending?.(row.id)) {
    return null;
  }
  const index = items.findIndex((item) => item.id === row.id);
  if (index < 0) {
    return null;
  }
  const current = items[index]!;
  if (!isNewerUpdatedAt(row.updated_at, current.updated_at)) {
    return null;
  }
  const preserve = options.preserveFields;
  const fieldsToApply =
    preserve && preserve.length > 0
      ? fields.filter((field) => !preserve.includes(field))
      : fields;
  if (fieldsToApply.length === 0) {
    return null;
  }
  const next = [...items];
  next[index] = mergeWorkItemRealtimeRow(current, row, fieldsToApply);
  return next;
}
