import type { DbWorkItem } from '@/app/work-items/_types/work-items.reads.types';

/** Group direct children by `parent_id` for hierarchy expand seeding. */
export function groupWorkItemsByParentId(
  children: readonly DbWorkItem[]
): Record<string, DbWorkItem[]> {
  const byParent: Record<string, DbWorkItem[]> = {};
  for (const child of children) {
    if (!child.parent_id) {
      continue;
    }
    const bucket = byParent[child.parent_id];
    if (bucket) {
      bucket.push(child);
    } else {
      byParent[child.parent_id] = [child];
    }
  }
  return byParent;
}

/**
 * Seed expand cache for a known forest slice (page or search panel).
 * Every id gets an entry — missing children are `[]` so expand stays local.
 */
export function seedForestChildrenByParentId(
  items: readonly DbWorkItem[]
): Record<string, DbWorkItem[]> {
  const byParent = groupWorkItemsByParentId(items);
  for (const item of items) {
    if (!(item.id in byParent)) {
      byParent[item.id] = [];
    }
  }
  return byParent;
}

/** @deprecated Use {@link seedForestChildrenByParentId}. */
export const seedSearchPanelChildrenByParentId = seedForestChildrenByParentId;

/** Collect `rootId` and every descendant present in `byParent`. */
export function collectSubtreeItems(
  rootId: string,
  byId: ReadonlyMap<string, DbWorkItem>,
  byParent: Readonly<Record<string, readonly DbWorkItem[]>>
): DbWorkItem[] {
  const root = byId.get(rootId);
  if (!root) {
    return [];
  }
  const subtree: DbWorkItem[] = [];
  const queue = [rootId];
  const seen = new Set<string>();
  while (queue.length > 0) {
    const id = queue.shift();
    if (!id || seen.has(id)) {
      continue;
    }
    seen.add(id);
    const item = byId.get(id);
    if (!item) {
      continue;
    }
    subtree.push(item);
    for (const child of byParent[id] ?? []) {
      queue.push(child.id);
    }
  }
  return subtree;
}

export function childrenByParentIdToMap(
  record: Record<string, readonly DbWorkItem[]> | null | undefined
): Map<string, DbWorkItem[]> {
  const next = new Map<string, DbWorkItem[]>();
  if (!record) {
    return next;
  }
  for (const [parentId, children] of Object.entries(record)) {
    next.set(parentId, [...children]);
  }
  return next;
}
