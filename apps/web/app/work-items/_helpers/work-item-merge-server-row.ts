import type { DbWorkItem } from '@/app/work-items/_services/work-items.reads.server';

/**
 * Merge a successful work-item PATCH into local list/detail state so the next
 * mutation sends a fresh `expectedUpdatedAt`.
 */
export function mergeWorkItemServerRow(
  current: DbWorkItem,
  updated: DbWorkItem
): DbWorkItem {
  const nextUpdatedAt =
    typeof updated.updated_at === 'string' && updated.updated_at.trim()
      ? updated.updated_at
      : current.updated_at;

  return {
    ...current,
    ...updated,
    assignee: updated.assignee ?? current.assignee,
    updated_at: nextUpdatedAt,
  };
}

/** Replace one row in a list by id; returns a new array only when found. */
export function replaceWorkItemInList(
  items: readonly DbWorkItem[],
  updated: DbWorkItem
): DbWorkItem[] {
  const index = items.findIndex((item) => item.id === updated.id);
  if (index < 0) {
    return [...items];
  }
  const next = [...items];
  next[index] = mergeWorkItemServerRow(items[index]!, updated);
  return next;
}
