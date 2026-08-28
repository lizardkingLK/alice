import { z } from 'zod';
import type { work_itemsGetPayload } from '../../generated/prisma/models/work_items.js';
import { projectRelationSelect } from '../../projects.js';
import { userRelationSelect } from '../../users.js';
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

/** PostgREST embeds — keep aligned with `workItemUserSelect`. */
export const WORK_ITEM_ASSIGNEE_POSTGREST_SELECT = userRelationSelect(
  'assignee',
  'assignee_id'
);
export const WORK_ITEM_REPORTER_POSTGREST_SELECT = userRelationSelect(
  'reporter',
  'reporter_id'
);

/**
 * PostgREST scalar columns for list/board reads.
 * Field list must stay aligned with `workItemListSelect` keys.
 */
export const WORK_ITEM_LIST_POSTGREST_COLUMNS =
  'id, project_id, sprint_id, parent_id, title, type, priority, labels, assignee_id, reporter_id, due_date, story_points, status, record_status, done_at, created_by, created_at, updated_by, updated_at, jira_issue_key' as const;

/** PostgREST select for list/board reads (optional TipTap description). */
export function workItemListPostgrestSelect(
  includeDescription: boolean
): string {
  const columns = includeDescription
    ? `${WORK_ITEM_LIST_POSTGREST_COLUMNS}, description`
    : WORK_ITEM_LIST_POSTGREST_COLUMNS;
  return `${columns}, ${WORK_ITEM_ASSIGNEE_POSTGREST_SELECT}, ${WORK_ITEM_REPORTER_POSTGREST_SELECT}`;
}

export const WORK_ITEM_PROJECT_POSTGREST_SELECT = projectRelationSelect();
export const WORK_ITEM_SPRINT_POSTGREST_SELECT = 'sprint:sprints(id, name)';

/** PostgREST select for detail reads — aligned with `workItemDetailSelect` embeds. */
export function workItemDetailPostgrestSelect(): string {
  return `*, ${WORK_ITEM_ASSIGNEE_POSTGREST_SELECT}, ${WORK_ITEM_REPORTER_POSTGREST_SELECT}, ${WORK_ITEM_PROJECT_POSTGREST_SELECT}, ${WORK_ITEM_SPRINT_POSTGREST_SELECT}`;
}

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
  record_status: true,
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
  /** Restrict to these projects (membership scope). Intersects with `projectId` when both set. */
  projectIds?: readonly string[];
  parentId?: string | null;
  type?: WorkItemType;
  assigneeId?: string;
  labels?: string[];
  /** Lifecycle filter. Defaults to `active` on list endpoints. */
  recordStatus?: 'active' | 'archived';
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
    recordStatus: z.preprocess(
      emptyToUndefined,
      z.enum(['active', 'archived']).optional()
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
      recordStatus: query.recordStatus ?? 'active',
    };
  });

export type ListWorkItemsQuery = z.infer<typeof listWorkItemsQuerySchema>;
