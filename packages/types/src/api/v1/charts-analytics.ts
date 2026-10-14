import { z } from 'zod';
import {
  emptyToUndefined,
  paginatedListLimitField,
  paginatedListPageField,
} from './query-preprocess.js';
import { WORK_ITEM_PRIORITIES } from '../../work-item-priorities.js';
import { WORK_ITEM_STATUSES } from '../../work-item-status.js';
import { WORK_ITEM_TYPES } from '../../work-item-types.js';
import {
  WORKFLOW_STATE_CATEGORIES,
  type WorkflowStateCategory,
} from '../../work-item-state.js';
import type { work_itemsGetPayload } from '../../generated/prisma/models/work_items.js';
import {
  workItemListSelect,
  workItemProjectSelect,
  workItemSprintSelect,
} from './work-items.js';

/**
 * Labels → Columns group-by fields backed by `work_item_chart_rollups`.
 * UI ids `board` / `owner` map to rollup `project_id` / `assignee_id`.
 * `category` / `state` are workflow placement dimensions (Step 7).
 * `state` requires a concrete single-project scope.
 * Unsupported UI fields (`group`, `name`, `dueDate`) are not accepted here.
 */
export const CHART_SERIES_LABEL_FIELDS = [
  'status',
  'category',
  'state',
  'owner',
  'board',
  'type',
  'priority',
] as const;

export type ChartSeriesLabelField = (typeof CHART_SERIES_LABEL_FIELDS)[number];

/** Rollup / work_items column used for a series label field. */
export type ChartRollupGroupColumn =
  | 'status'
  | 'status_category'
  | 'state_id'
  | 'assignee_id'
  | 'project_id'
  | 'type'
  | 'priority';

export function chartRollupGroupColumn(
  labelField: ChartSeriesLabelField
): ChartRollupGroupColumn {
  switch (labelField) {
    case 'owner':
      return 'assignee_id';
    case 'board':
      return 'project_id';
    case 'status':
      return 'status';
    case 'category':
      return 'status_category';
    case 'state':
      return 'state_id';
    case 'type':
      return 'type';
    case 'priority':
      return 'priority';
  }
}

/** Display label for a workflow status category slice. */
export function chartCategoryDisplayLabel(category: string): string {
  switch (category as WorkflowStateCategory) {
    case 'draft':
      return 'Draft';
    case 'todo':
      return 'To do';
    case 'in_progress':
      return 'In progress';
    case 'done':
      return 'Done';
    default:
      return category;
  }
}

export function isWorkflowStateCategory(
  value: string
): value is WorkflowStateCategory {
  return (WORKFLOW_STATE_CATEGORIES as readonly string[]).includes(value);
}

/** Empty slice key means SQL NULL (e.g. unassigned owner). */
export const CHART_SERIES_NULL_SLICE_KEY = '';

const optionalUuid = z.preprocess(emptyToUndefined, z.uuid().optional());
const optionalDateOnly = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
    .optional()
);

/** Shared scope + equality filters for categorical and hierarchy analytics. */
const chartScopeFilterFields = {
  /**
   * When omitted, series/drilldown aggregate across all projects the actor can
   * access (Charts “All projects” filter).
   */
  projectId: optionalUuid,
  from: optionalDateOnly,
  to: optionalDateOnly,
  sprintId: optionalUuid,
  /** Quick / advanced equality filters applied on rollups and drilldown. */
  status: z.preprocess(emptyToUndefined, z.enum(WORK_ITEM_STATUSES).optional()),
  type: z.preprocess(emptyToUndefined, z.enum(WORK_ITEM_TYPES).optional()),
  priority: z.preprocess(
    emptyToUndefined,
    z.enum(WORK_ITEM_PRIORITIES).optional()
  ),
  /**
   * Assignee UUID; omit for any assignee.
   * Empty string means unassigned (NULL assignee_id).
   */
  assigneeId: z.preprocess(
    (value) => {
      if (value === '' || value === 'unassigned') {
        return '';
      }
      return emptyToUndefined(value);
    },
    z.union([z.uuid(), z.literal('')]).optional()
  ),
} as const;

const chartAnalyticsFilterFields = {
  ...chartScopeFilterFields,
  labelField: z.preprocess(
    (value) => (value === undefined || value === '' ? 'status' : value),
    z.enum(CHART_SERIES_LABEL_FIELDS)
  ),
} as const;

const chartDateRangeRefine = <T extends { from?: string; to?: string }>(
  schema: z.ZodType<T>
) =>
  schema.refine((query) => !(query.from && query.to) || query.from <= query.to, {
    message: '`from` must be on or before `to`',
    path: ['from'],
  });

export const chartSeriesQuerySchema = chartDateRangeRefine(
  z.object(chartAnalyticsFilterFields)
);

export type ChartSeriesQuery = z.infer<typeof chartSeriesQuerySchema>;

export const chartDrilldownQuerySchema = chartDateRangeRefine(
  z.object({
    ...chartAnalyticsFilterFields,
    /**
     * Dimension value; empty string selects NULL (e.g. unassigned).
     * Omit to return all items in scope (table layout, all status groups).
     */
    sliceKey: z.string().optional(),
    page: paginatedListPageField,
    limit: paginatedListLimitField(20, 100),
  })
);

export type ChartDrilldownQuery = z.infer<typeof chartDrilldownQuerySchema>;

export type ChartSeriesSlice = {
  /** Stable bucket id; empty string = NULL dimension. */
  key: string;
  /** Display label (status/type/priority value, user name, or project name). */
  label: string;
  count: number;
};

export type ChartSeriesResponse = {
  /** Concrete project, or `null` when scoped to all accessible projects. */
  projectId: string | null;
  labelField: ChartSeriesLabelField;
  from?: string;
  to?: string;
  sprintId?: string;
  slices: ChartSeriesSlice[];
  totalCount: number;
};

/** Drilldown rows reuse the compact work-item list select + project/sprint names. */
export const chartDrilldownItemSelect = {
  ...workItemListSelect,
  project: { select: workItemProjectSelect },
  sprint: { select: workItemSprintSelect },
} as const;

export type ChartDrilldownItemRow = work_itemsGetPayload<{
  select: typeof chartDrilldownItemSelect;
}>;

export type ChartDrilldownResponse = {
  /** Concrete project, or `null` when scoped to all accessible projects. */
  projectId: string | null;
  labelField: ChartSeriesLabelField;
  /** Empty when drilldown was not slice-scoped. */
  sliceKey: string;
  workItems: ChartDrilldownItemRow[];
  totalCount: number;
  page: number;
  limit: number;
  totalPages: number;
};

/** Nested-donut Values measure (count nodes vs sum story points). */
export const CHART_HIERARCHY_MEASURES = ['item_count', 'story_points'] as const;
export type ChartHierarchyMeasure = (typeof CHART_HIERARCHY_MEASURES)[number];

/**
 * Nested-donut rings: 0 = roots, 1 = direct children, 2 = grandchildren
 * (Epic → Story → Subtask). Depth capped at 3.
 */
export const CHART_HIERARCHY_RING_LEVELS = [0, 1, 2] as const;
export type ChartHierarchyRingLevel = (typeof CHART_HIERARCHY_RING_LEVELS)[number];

/** Max nested-donut depth (root + 2 descendant rings). */
export const CHART_HIERARCHY_MAX_DEPTH = CHART_HIERARCHY_RING_LEVELS.length;

const chartHierarchyFilterFields = {
  ...chartScopeFilterFields,
  measure: z.preprocess(
    (value) => (value === undefined || value === '' ? 'item_count' : value),
    z.enum(CHART_HIERARCHY_MEASURES)
  ),
  /**
   * When set, rings are rooted under this work item (disk-analyzer dig):
   * ring 0 = its direct children in scope.
   */
  rootWorkItemId: optionalUuid,
} as const;

export const chartHierarchySeriesQuerySchema = chartDateRangeRefine(
  z.object(chartHierarchyFilterFields)
);

export type ChartHierarchySeriesQuery = z.infer<
  typeof chartHierarchySeriesQuerySchema
>;

export const chartHierarchyDrilldownQuerySchema = chartDateRangeRefine(
  z.object({
    ...chartHierarchyFilterFields,
    /** 0 = root, 1 = child, 2 = grandchild. Omit for unscoped table. */
    ring: z.preprocess(
      emptyToUndefined,
      z.coerce.number().int().min(0).max(2).optional()
    ),
    /** Work-item id for the focused slice. */
    sliceKey: z.string().optional(),
    /** Immediate parent id when ring ≥ 1. */
    parentKey: z.string().optional(),
    page: paginatedListPageField,
    limit: paginatedListLimitField(20, 100),
  })
);

export type ChartHierarchyDrilldownQuery = z.infer<
  typeof chartHierarchyDrilldownQuerySchema
>;

export type ChartHierarchySlice = {
  /** Work-item id. */
  key: string;
  label: string;
  value: number;
  /** Set on outer-ring slices: parent work-item id. */
  parentKey?: string;
  /** True when this node has in-scope children (click digs instead of table). */
  hasChildren: boolean;
};

export type ChartHierarchyRing = {
  level: ChartHierarchyRingLevel;
  slices: ChartHierarchySlice[];
};

export type ChartHierarchySeriesResponse = {
  projectId: string | null;
  measure: ChartHierarchyMeasure;
  /** Dig root; null when showing top-level promoted roots. */
  rootWorkItemId: string | null;
  from?: string;
  to?: string;
  sprintId?: string;
  rings: ChartHierarchyRing[];
  /** Sum of inner-ring values (every root counted once). */
  totalValue: number;
};

export type ChartHierarchyDrilldownResponse = {
  projectId: string | null;
  measure: ChartHierarchyMeasure;
  ring: ChartHierarchyRingLevel | null;
  sliceKey: string;
  parentKey: string;
  workItems: ChartDrilldownItemRow[];
  totalCount: number;
  page: number;
  limit: number;
  totalPages: number;
};
