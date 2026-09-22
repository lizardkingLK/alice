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
