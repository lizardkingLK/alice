import { z } from 'zod';

export const WORK_ITEM_LINK_TYPES = ['relates_to'] as const;
export type WorkItemLinkType = (typeof WORK_ITEM_LINK_TYPES)[number];

export const createWorkItemLinkBodySchema = z.object({
  target_id: z.string().uuid(),
});

export type CreateWorkItemLinkBody = z.infer<
  typeof createWorkItemLinkBodySchema
>;

/** Linked peer as shown from the open work item's perspective. */
export type WorkItemLinkRelatedItem = {
  readonly id: string;
  readonly title: string;
  readonly type: string;
  readonly status: string;
  readonly state: unknown;
  readonly updated_at: string;
};

export type WorkItemLinkListItem = {
  readonly id: string;
  readonly link_type: WorkItemLinkType;
  readonly project_id: string;
  readonly related: WorkItemLinkRelatedItem;
  readonly created_at: string;
};

/** Canonical undirected pair: lower uuid as source, higher as target. */
export function canonicalWorkItemLinkPair(
  a: string,
  b: string
): { sourceId: string; targetId: string } {
  return a < b ? { sourceId: a, targetId: b } : { sourceId: b, targetId: a };
}
