import type { WorkItemAncestor } from '@/app/work-items/_types/work-items.reads.types';

/** Max hops above a leaf Issue (Task → Story → Epic). */
export const MAX_WORK_ITEM_ANCESTOR_DEPTH = 3;

/**
 * Nested PostgREST select: load the immediate parent plus up to two further
 * parents in one round-trip (matches {@link MAX_WORK_ITEM_ANCESTOR_DEPTH}).
 */
export const WORK_ITEM_ANCESTOR_EMBED_SELECT =
  'id, type, title, parent_id, parent:work_items!parent_id(id, type, title, parent_id, parent:work_items!parent_id(id, type, title, parent_id))';

export type WorkItemAncestorEmbedRow = {
  readonly id: string;
  readonly type: WorkItemAncestor['type'];
  readonly title: string;
  readonly parent_id: string | null;
  readonly parent?: WorkItemAncestorEmbedRow | null;
};

/**
 * Flatten a nested parent embed into root-first ancestors
 * (Epic → … → immediate parent), capped at max depth.
 */
export function flattenWorkItemAncestorEmbed(
  row: WorkItemAncestorEmbedRow | null | undefined,
  maxDepth: number = MAX_WORK_ITEM_ANCESTOR_DEPTH
): WorkItemAncestor[] {
  if (!row) {
    return [];
  }

  const leafToRoot: WorkItemAncestor[] = [];
  let current: WorkItemAncestorEmbedRow | null | undefined = row;
  let depth = 0;

  while (current && depth < maxDepth) {
    leafToRoot.push({
      id: current.id,
      type: current.type,
      title: current.title,
      parent_id: current.parent_id,
    });
    current = current.parent ?? null;
    depth += 1;
  }

  return leafToRoot.reverse();
}
