import type { DbWorkItem } from '@/app/work-items/_services/work-items.reads.server';

/**
 * Merge a successful work-item PATCH into local list/detail state so the next
 * mutation sends a fresh `expectedUpdatedAt`.
 */
export function mergeWorkItemServerRow(
  current: DbWorkItem,
  updated: DbWorkItem
): DbWorkItem {
  return {
    ...current,
    ...updated,
    assignee: updated.assignee ?? current.assignee,
  };
}
