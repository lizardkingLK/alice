import { z } from 'zod';
import type { work_itemsGetPayload } from '../../generated/prisma/models/work_items.js';
import { todayDateString, toDateOnly } from '../../date-only.js';
import { expectedUpdatedAtSchema } from '../../optimistic-lock.js';
import { projectRelationSelect } from './projects.js';
import { userRelationSelect } from '../../users.js';
import { WORK_ITEM_PRIORITIES } from '../../work-item-priorities.js';
import { WORK_ITEM_STATUSES } from '../../work-item-status.js';
import { WORK_ITEM_TYPES, type WorkItemType } from '../../work-item-types.js';
import {
  coerceLabelsFormField,
  normalizeWorkItemLabels,
  parseWorkItemLabelsFilterParam,
  WorkItemLabelsValidationError,
} from '../../work-item-labels.js';

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

/** Maps Prisma `Date` fields to ISO strings (PostgREST / JSON wire shape). */
export type WireRow<T> = T extends null
  ? null
  : T extends Date
    ? string
    : T extends readonly (infer U)[]
      ? WireRow<U>[]
      : T extends object
        ? { [K in keyof T]: WireRow<T[K]> }
        : T;

export type WorkItemListWireRow = WireRow<WorkItemListRow>;
export type WorkItemListWithDescriptionWireRow =
  WireRow<WorkItemListRowWithDescription>;
export type WorkItemDetailWireRow = WireRow<WorkItemDetailRow>;

/** User embed on work-item read rows (PostgREST / Express JSON). */
export type WorkItemUserWireRow = {
  id: string;
  name: string;
  email: string;
  profile_picture?: string | null;
};

/**
 * Page-level read row: list shape plus optional detail-only embeds
 * (compact list queries omit `description` / `project` / `sprint` keys).
 */
export type WorkItemReadRow = Omit<
  WorkItemListWireRow,
  'assignee' | 'reporter'
> & {
  assignee: WorkItemUserWireRow | null;
  reporter: WorkItemUserWireRow | null;
  description?: WorkItemListWithDescriptionWireRow['description'];
  project?: WorkItemDetailWireRow['project'];
  sprint?: WorkItemDetailWireRow['sprint'];
};

/** Minimal ancestor fields for the in-page hierarchy path. */
export type WorkItemAncestorWireRow = Pick<
  WorkItemReadRow,
  'id' | 'type' | 'title' | 'parent_id'
>;

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

// --- Mutation wire schemas (POST create, PATCH update) ---

const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format');

const workItemTypeSchema = z.enum(WORK_ITEM_TYPES, {
  message: 'Please select a work item type',
});

const workItemPrioritySchema = z.enum(WORK_ITEM_PRIORITIES, {
  message: 'Please select a valid priority',
});

export const workItemStatusSchema = z.enum(WORK_ITEM_STATUSES, {
  message: 'Please select a valid status',
});

/**
 * PATCH may resubmit an existing past due date (edit forms). Block only when
 * the client changes due_date to a *new* past date.
 */
export function isBlockedPastDueDateChange(
  nextDueDate: string | null | undefined,
  existingDueDate: string | null | undefined
): boolean {
  if (nextDueDate === undefined || nextDueDate === null) {
    return false;
  }
  if (nextDueDate >= todayDateString()) {
    return false;
  }
  return nextDueDate !== toDateOnly(existingDueDate);
}

function emptyStringToNull(value: unknown): unknown {
  return value === '' || value === undefined ? null : value;
}

function stringToNumberOrNull(value: unknown): unknown {
  if (value === '' || value === undefined || value === null) {
    return null;
  }
  if (typeof value === 'string') {
    const num = Number(value);
    return Number.isNaN(num) ? value : num;
  }
  return value;
}

const labelsFieldSchema = z
  .any()
  .transform((value, ctx) => {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    try {
      return normalizeWorkItemLabels(value);
    } catch (error) {
      const message =
        error instanceof WorkItemLabelsValidationError
          ? error.message
          : 'Invalid labels';
      ctx.addIssue({ code: 'custom', message });
      return z.NEVER;
    }
  })
  .optional();

const literalSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
type Literal = z.infer<typeof literalSchema>;
export type SupabaseJson =
  Literal | { [key: string]: SupabaseJson } | SupabaseJson[];

/** TipTap / JSONB description field on work items. */
export const jsonSchema: z.ZodType<SupabaseJson> = z.lazy(() =>
  z.union([
    literalSchema,
    z.array(z.lazy(() => jsonSchema)),
    z.record(
      z.string(),
      z.lazy(() => jsonSchema)
    ),
  ])
) as z.ZodType<SupabaseJson>;

export const workItemCoreObject = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Title is required')
    .max(200, 'Title must be at most 200 characters'),
  project_id: z.uuid({ message: 'Please select a valid project' }),
  type: workItemTypeSchema,
  priority: z.preprocess((value) => {
    if (value === '' || value === undefined || value === null) {
      return undefined;
    }
    return value;
  }, workItemPrioritySchema.optional()),
  assignee_id: z.preprocess(
    emptyStringToNull,
    z.uuid({ message: 'Please select a valid assignee' }).nullable()
  ),
  reporter_id: z
    .preprocess(
      emptyStringToNull,
      z.uuid({ message: 'Please select a valid reporter' }).nullable()
    )
    .optional(),
  due_date: z.preprocess(emptyStringToNull, dateStringSchema.nullable()),
  description: jsonSchema.nullable().optional(),
  labels: labelsFieldSchema,
  sprint_id: z
    .preprocess(
      emptyStringToNull,
      z.uuid({ message: 'Please select a valid sprint' }).nullable()
    )
    .optional(),
  story_points: z
    .preprocess(
      stringToNumberOrNull,
      z
        .number()
        .int({ message: 'Story points must be a whole number' })
        .min(0, { message: 'Story points must be at least 0' })
        .nullable()
    )
    .optional(),
  jira_issue_key: z
    .string()
    .trim()
    .max(255, { message: 'Jira issue key must be at most 255 characters' })
    .nullable()
    .optional(),
  parent_id: z
    .preprocess(
      emptyStringToNull,
      z.uuid({ message: 'Please select a valid parent work item' }).nullable()
    )
    .optional(),
  status: z.preprocess((value) => {
    if (value === '' || value === undefined || value === null) {
      return undefined;
    }
    return value;
  }, workItemStatusSchema.optional()),
});

export const createWorkItemBodySchema = workItemCoreObject.refine(
  (data) => {
    if (data.due_date) return data.due_date >= todayDateString();
    return true;
  },
  {
    message: 'Due date must be on or after today',
    path: ['due_date'],
  }
);

/** PATCH: past due dates allowed when unchanged; see isBlockedPastDueDateChange. */
export const patchWorkItemBodySchema = workItemCoreObject
  .extend({
    status: workItemStatusSchema,
  })
  .partial()
  .extend({
    expectedUpdatedAt: expectedUpdatedAtSchema,
  })
  .refine(
    (data) => Object.keys(data).some((key) => key !== 'expectedUpdatedAt'),
    {
      message: 'At least one field must be provided for update',
    }
  );

export const patchWorkItemStatusBodySchema = z.object({
  status: workItemStatusSchema,
  expectedUpdatedAt: expectedUpdatedAtSchema,
});

export const workItemLifecycleActionBodySchema = z.object({
  expectedUpdatedAt: expectedUpdatedAtSchema,
});

/** Wire input for `POST /api/workItems/:id/github` (format only; repo match is service logic). */
export const githubWorkItemPrUrlSchema = z
  .string()
  .trim()
  .min(1, 'prUrl is required and must be a string')
  .regex(
    /^(?:https?:\/\/github\.com\/)?([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)\/pull\/(\d+)$/,
    'Invalid GitHub PR URL. Expected format: https://github.com/owner/repo/pull/number'
  );

export const linkWorkItemGithubPrBodySchema = z.object({
  prUrl: githubWorkItemPrUrlSchema,
});

export type CreateWorkItemBody = z.infer<typeof createWorkItemBodySchema>;
export type PatchWorkItemBody = z.infer<typeof patchWorkItemBodySchema>;
export type PatchWorkItemStatusBody = z.infer<
  typeof patchWorkItemStatusBodySchema
>;
export type WorkItemLifecycleActionBody = z.infer<
  typeof workItemLifecycleActionBodySchema
>;
export type LinkWorkItemGithubPrBody = z.infer<
  typeof linkWorkItemGithubPrBodySchema
>;

export type WorkItemUpdateBody = CreateWorkItemBody & {
  status: z.infer<typeof workItemStatusSchema>;
};

export type WorkItemMutationDescriptionParseMode = 'strict' | 'lenient';

/**
 * Normalize FormData / JSON bodies before Zod parse.
 * - `strict` (PATCH): invalid description JSON → `null`
 * - `lenient` (create forms): invalid description JSON stays a plain string
 */
export function preprocessWorkItemMutationBody(
  body: Record<string, unknown>,
  options: { descriptionParseMode?: WorkItemMutationDescriptionParseMode } = {}
): Record<string, unknown> | null {
  const { descriptionParseMode = 'strict' } = options;
  const processed = { ...body };

  if (typeof body.description === 'string') {
    const raw = body.description.trim();
    if (!raw) {
      delete processed.description;
    } else {
      try {
        processed.description = JSON.parse(raw);
      } catch {
        if (descriptionParseMode === 'lenient') {
          processed.description = body.description;
        } else {
          return null;
        }
      }
    }
  }

  if ('labels' in body) {
    processed.labels = coerceLabelsFormField(body.labels);
  }

  return processed;
}
