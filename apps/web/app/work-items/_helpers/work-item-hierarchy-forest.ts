import type {
  DbWorkItem,
  WorkItemAncestor,
} from '@/app/work-items/_types/work-items.reads.types';
import { groupWorkItemsByParentId } from '@/app/work-items/_helpers/work-item-hierarchy-children';

/** Browse hierarchy: hard row budget per page (roots + descendants). */
export const HIERARCHY_FOREST_PAGE_SIZE = 100;

export type ForestWalkItem = {
  readonly workItem: DbWorkItem;
  readonly rootId: string;
  /** Root-first ancestors excluding the item itself. */
  readonly ancestors: readonly WorkItemAncestor[];
};

function toAncestor(item: DbWorkItem): WorkItemAncestor {
  return {
    id: item.id,
    type: item.type,
    title: item.title,
    parent_id: item.parent_id,
  };
}

/** Index work items by id. */
export function indexWorkItemsById(
  items: readonly DbWorkItem[]
): Map<string, DbWorkItem> {
  const byId = new Map<string, DbWorkItem>();
  for (const item of items) {
    byId.set(item.id, item);
  }
  return byId;
}

/**
 * Roots for a candidate set: `parent_id` null, or parent missing from the set
 * (filtered orphan).
 */
export function findForestRoots(
  items: readonly DbWorkItem[],
  byId: ReadonlyMap<string, DbWorkItem> = indexWorkItemsById(items)
): DbWorkItem[] {
  const roots: DbWorkItem[] = [];
  for (const item of items) {
    if (!item.parent_id || !byId.has(item.parent_id)) {
      roots.push(item);
    }
  }
  return roots;
}

/**
 * Build root-first ancestors for `itemId` walking `parent_id` within `byId`.
 */
export function ancestorsWithinIndex(
  itemId: string,
  byId: ReadonlyMap<string, DbWorkItem>
): WorkItemAncestor[] {
  const leafToRoot: WorkItemAncestor[] = [];
  let current = byId.get(itemId);
  const guard = new Set<string>();

  while (current?.parent_id) {
    if (guard.has(current.parent_id)) {
      break;
    }
    guard.add(current.parent_id);
    const parent = byId.get(current.parent_id);
    if (!parent) {
      break;
    }
    leafToRoot.push(toAncestor(parent));
    current = parent;
  }

  return leafToRoot.reverse();
}

function compareCreatedAtDesc(a: DbWorkItem, b: DbWorkItem): number {
  const aTime = a.created_at ?? '';
  const bTime = b.created_at ?? '';
  if (aTime === bTime) {
    if (a.id < b.id) {
      return -1;
    }
    if (a.id > b.id) {
      return 1;
    }
    return 0;
  }
  return aTime < bTime ? 1 : -1;
}

/**
 * Depth-first forest order (sibling order = created_at desc, matching list).
 */
export function walkForestDfs(items: readonly DbWorkItem[]): ForestWalkItem[] {
  const byId = indexWorkItemsById(items);
  const childrenByParent = groupWorkItemsByParentId(items);
  for (const children of Object.values(childrenByParent)) {
    children.sort(compareCreatedAtDesc);
  }

  const roots = findForestRoots(items, byId).sort(compareCreatedAtDesc);
  const ordered: ForestWalkItem[] = [];
  const visited = new Set<string>();

  const visit = (item: DbWorkItem, rootId: string) => {
    if (visited.has(item.id)) {
      return;
    }
    visited.add(item.id);
    ordered.push({
      workItem: item,
      rootId,
      ancestors: ancestorsWithinIndex(item.id, byId),
    });
    const children = childrenByParent[item.id] ?? [];
    for (const child of children) {
      visit(child, rootId);
    }
  };

  for (const root of roots) {
    visit(root, root.id);
  }

  return ordered;
}

export type ForestPageSlice = {
  readonly items: readonly ForestWalkItem[];
  readonly totalCount: number;
  readonly page: number;
  readonly limit: number;
  readonly totalPages: number;
  /** Table roots for this page (unique roots represented). */
  readonly pageRoots: readonly DbWorkItem[];
  /** Children present on this page, keyed by parent. */
  readonly childrenByParentId: Record<string, DbWorkItem[]>;
};

/**
 * Page the DFS walk. When the offset lands mid-tree, the current root is
 * prefixed (may yield limit+1 rows so unique nodes are not dropped).
 */
export function sliceForestPage(
  ordered: readonly ForestWalkItem[],
  page: number,
  limit: number
): ForestPageSlice {
  const safePage = Math.max(1, page);
  const safeLimit = Math.max(1, limit);
  const totalCount = ordered.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / safeLimit) || 1);
  const offset = (safePage - 1) * safeLimit;

  if (offset >= totalCount || totalCount === 0) {
    return {
      items: [],
      totalCount,
      page: safePage,
      limit: safeLimit,
      totalPages,
      pageRoots: [],
      childrenByParentId: {},
    };
  }

  const window = ordered.slice(offset, offset + safeLimit);
  const first = window[0];
  const items: ForestWalkItem[] = [];

  if (first && first.workItem.id !== first.rootId) {
    const rootEntry = ordered.find(
      (entry) => entry.workItem.id === first.rootId
    );
    if (rootEntry) {
      items.push(rootEntry);
    }
  }

  for (const entry of window) {
    if (items.some((existing) => existing.workItem.id === entry.workItem.id)) {
      continue;
    }
    items.push(entry);
  }

  const onPage = items.map((entry) => entry.workItem);
  const pageItemIds = new Set(onPage.map((item) => item.id));
  // Rows whose parent is absent on this page render as top-level (continuation).
  const pageRoots = onPage.filter(
    (item) => !item.parent_id || !pageItemIds.has(item.parent_id)
  );
  const childrenByParentId = groupWorkItemsByParentId(
    onPage.filter(
      (item) => item.parent_id != null && pageItemIds.has(item.parent_id)
    )
  );

  return {
    items,
    totalCount,
    page: safePage,
    limit: safeLimit,
    totalPages,
    pageRoots,
    childrenByParentId,
  };
}

/**
 * Closure of matches plus ancestors present in `byId`. Missing parents are
 * omitted (caller should merge fetched ancestors into `byId` first).
 */
export function buildSearchPanelItems(
  matches: readonly DbWorkItem[],
  byId: ReadonlyMap<string, DbWorkItem>
): {
  readonly panelItems: DbWorkItem[];
  readonly matchIds: ReadonlySet<string>;
} {
  const matchIds = new Set(matches.map((item) => item.id));
  const panelIds = new Set<string>(matchIds);

  for (const match of matches) {
    let current = match;
    const guard = new Set<string>();
    while (current.parent_id) {
      if (guard.has(current.parent_id)) {
        break;
      }
      guard.add(current.parent_id);
      const parent = byId.get(current.parent_id);
      if (!parent) {
        break;
      }
      panelIds.add(parent.id);
      current = parent;
    }
  }

  const panelItems: DbWorkItem[] = [];
  for (const id of panelIds) {
    const item = byId.get(id);
    if (item) {
      panelItems.push(item);
    }
  }

  return { panelItems, matchIds };
}

/** Collect parent ids referenced but missing from `byId`. */
export function missingAncestorIds(
  items: readonly DbWorkItem[],
  byId: ReadonlyMap<string, DbWorkItem>
): string[] {
  const missing = new Set<string>();
  for (const item of items) {
    let parentId = item.parent_id;
    const guard = new Set<string>();
    while (parentId) {
      if (guard.has(parentId)) {
        break;
      }
      guard.add(parentId);
      if (byId.has(parentId)) {
        parentId = byId.get(parentId)?.parent_id ?? null;
        continue;
      }
      missing.add(parentId);
      break;
    }
  }
  return [...missing];
}
