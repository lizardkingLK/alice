import type { WorkItemType } from '@repo/types';
import { getAllowedChildType } from '@repo/types';
import type { DbWorkItem } from '@/app/work-items/_services/work-items.reads.server';

export type WorkItemHierarchyDisplayRow = {
  readonly workItem: DbWorkItem;
  readonly depth: number;
  readonly canExpand: boolean;
  readonly isExpanded: boolean;
  readonly isLoading: boolean;
};

export function workItemCanExpand(type: WorkItemType): boolean {
  return getAllowedChildType(type) !== null;
}

/**
 * Depth-first flatten of roots + lazily loaded children for table display.
 * Only walks into parents listed in `expandedIds`.
 */
export function flattenWorkItemHierarchyRows(
  roots: readonly DbWorkItem[],
  childrenByParentId: ReadonlyMap<string, readonly DbWorkItem[]>,
  expandedIds: ReadonlySet<string>,
  loadingIds: ReadonlySet<string> = new Set()
): WorkItemHierarchyDisplayRow[] {
  const rows: WorkItemHierarchyDisplayRow[] = [];

  const visit = (item: DbWorkItem, depth: number) => {
    const canExpand = workItemCanExpand(item.type);
    const isExpanded = canExpand && expandedIds.has(item.id);
    const isLoading = loadingIds.has(item.id);

    rows.push({
      workItem: item,
      depth,
      canExpand,
      isExpanded,
      isLoading,
    });

    if (!isExpanded) {
      return;
    }

    const children = childrenByParentId.get(item.id) ?? [];
    for (const child of children) {
      visit(child, depth + 1);
    }
  };

  for (const root of roots) {
    visit(root, 0);
  }

  return rows;
}
