import type { WorkItemAncestor } from '@/app/work-items/_types/work-items.reads.types';

/** Max hops above a leaf Issue (Task → Story → Epic). */
export const MAX_WORK_ITEM_ANCESTOR_DEPTH = 3;

/**
 * Nested PostgREST select: load the immediate parent plus up to two further
 * parents in one round-trip (matches {@link MAX_WORK_ITEM_ANCESTOR_DEPTH}).
 *
 * Use `parent:parent_id(...)` (column hint) so PostgREST walks the many-to-one
 * parent. `parent:work_items!parent_id(...)` resolves the other direction of
 * the same FK and returns child arrays instead of parents.
 */
export const WORK_ITEM_ANCESTOR_EMBED_SELECT =
  'id, type, title, parent_id, parent:parent_id(id, type, title, parent_id, parent:parent_id(id, type, title, parent_id))';

export type WorkItemAncestorEmbedRow = {
  readonly id: string;
  readonly type: WorkItemAncestor['type'];
  readonly title: string;
  readonly parent_id: string | null;
  readonly parent?: WorkItemAncestorEmbedRow | null;
};

/**
 * Only follow a singular parent object. Wrong-direction embeds can return an
 * array of children; treating that as a parent would invent bogus ancestors.
 */
function asParentEmbed(
  parent:
    WorkItemAncestorEmbedRow | WorkItemAncestorEmbedRow[] | null | undefined
): WorkItemAncestorEmbedRow | null {
  if (!parent || Array.isArray(parent)) {
    return null;
  }
  return parent;
}

/**
 * Flatten a nested parent embed into root-first ancestors
 * (Epic → … → immediate parent), capped at max depth.
 * Stops early on repeated ids so parent cycles cannot produce duplicate
 * breadcrumb keys.
 */
export function flattenWorkItemAncestorEmbed(
  row: WorkItemAncestorEmbedRow | null | undefined,
  maxDepth: number = MAX_WORK_ITEM_ANCESTOR_DEPTH
): WorkItemAncestor[] {
  if (!row) {
    return [];
  }

  const leafToRoot: WorkItemAncestor[] = [];
  const seenIds = new Set<string>();
  let current: WorkItemAncestorEmbedRow | null | undefined = row;
  let depth = 0;

  while (current && depth < maxDepth) {
    if (seenIds.has(current.id)) {
      break;
    }
    seenIds.add(current.id);
    leafToRoot.push({
      id: current.id,
      type: current.type,
      title: current.title,
      parent_id: current.parent_id,
    });
    current = asParentEmbed(current.parent);
    depth += 1;
  }

  return leafToRoot.reverse();
}
