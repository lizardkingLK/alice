import { z } from 'zod';
import type { work_itemsGetPayload } from '../../generated/prisma/models/work_items.js';
import { WORK_ITEM_TYPES, type WorkItemType } from '../../work-item-types.js';
import { parseWorkItemLabelsFilterParam } from '../../work-item-labels.js';

/**
 * Prisma `select` objects for unused Express work-item GETs.
 * Field lists match RSC `workItemListSelect` / `getWorkItem` (no secrets).
 * Types-only Prisma imports — this module must not instantiate PrismaClient.
 */

export const workItemUserSelect = {
  id: true,
  name: true,
  email: true,
  profile_picture: true,
} as const;

export const workItemProjectSelect = {
  id: true,
  key: true,
  name: true,
} as const;

export const workItemSprintSelect = {
  id: true,
  name: true,
} as const;

/** List/board columns — omit TipTap `description` (matches RSC compact list). */
export const workItemListSelect = {
  id: true,
  project_id: true,
  sprint_id: true,
  parent_id: true,
  title: true,
  type: true,
  priority: true,
  labels: true,
  assignee_id: true,
  reporter_id: true,
  due_date: true,
  story_points: true,
  status: true,
  done_at: true,
  created_by: true,
  created_at: true,
  updated_by: true,
  updated_at: true,
  jira_issue_key: true,
  assignee: { select: workItemUserSelect },
  reporter: { select: workItemUserSelect },
} as const;

export const workItemListSelectWithDescription = {
  ...workItemListSelect,
  description: true,
} as const;

/** Detail: list columns + description + project/sprint embeds (no tokens). */
export const workItemDetailSelect = {
  ...workItemListSelectWithDescription,
  project: { select: workItemProjectSelect },
  sprint: { select: workItemSprintSelect },
} as const;

export type WorkItemListRow = work_itemsGetPayload<{
  select: typeof workItemListSelect;
}>;

export type WorkItemListRowWithDescription = work_itemsGetPayload<{
  select: typeof workItemListSelectWithDescription;
}>;

export type WorkItemDetailRow = work_itemsGetPayload<{
  select: typeof workItemDetailSelect;
}>;

export type WorkItemPrismaListFilters = {
  sprintId?: string | null;
  projectId?: string;
  parentId?: string | null;
  type?: WorkItemType;
  assigneeId?: string;
  labels?: string[];
};

function emptyToUndefined(value: unknown): unknown {
  if (value === '' || value === undefined || value === null) {
    return undefined;
  }
  return value;
}

const optionalUuid = z.preprocess(emptyToUndefined, z.uuid().optional());

const optionalNullableId = z.preprocess(
  emptyToUndefined,
  z.union([z.uuid(), z.literal('null')]).optional()
);

function resolveListParentId(
  parentId: string | null | undefined,
  view: 'flat' | 'hierarchy' | undefined
): string | null | undefined {
  if (parentId !== undefined) {
    return parentId;
  }
  if (view === 'hierarchy') {
    return null;
  }
  return undefined;
}

/**
 * GET `/api/workItems` query. Zod for filters/pagination; response is Prisma payload.
 * `sprintId=null` / `parentId=null` mean IS NULL (backlog / hierarchy roots).
 */
export const listWorkItemsQuerySchema = z
  .object({
    page: z.preprocess(
      (value) => (value === undefined || value === '' ? 1 : value),
      z.coerce.number().int().min(1)
    ),
    limit: z.preprocess(
      (value) => (value === undefined || value === '' ? 10 : value),
      z.coerce.number().int().min(1).max(100)
    ),
    search: z.preprocess(emptyToUndefined, z.string().optional()),
    projectId: optionalUuid,
    sprintId: optionalNullableId,
    parentId: optionalNullableId,
    type: z.preprocess(emptyToUndefined, z.enum(WORK_ITEM_TYPES).optional()),
    assigneeId: optionalUuid,
    labels: z.preprocess(emptyToUndefined, z.string().optional()),
    view: z.preprocess(
      emptyToUndefined,
      z.enum(['flat', 'hierarchy']).optional()
    ),
    includeDescription: z.preprocess(
      emptyToUndefined,
      z.enum(['true', 'false']).optional()
    ),
  })
  .transform((query) => {
    const sprintId = query.sprintId === 'null' ? null : query.sprintId;
    const explicitParentId = query.parentId === 'null' ? null : query.parentId;
    const parentId = resolveListParentId(explicitParentId, query.view);

    return {
      page: query.page,
      limit: query.limit,
      search: query.search,
      projectId: query.projectId,
      sprintId,
      parentId,
      type: query.type,
      assigneeId: query.assigneeId,
      labels: parseWorkItemLabelsFilterParam(query.labels),
      includeDescription: query.includeDescription === 'true',
    };
  });

export type ListWorkItemsQuery = z.infer<typeof listWorkItemsQuerySchema>;
