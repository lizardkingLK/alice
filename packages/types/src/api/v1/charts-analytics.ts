import { z } from 'zod';
import {
  emptyToUndefined,
  paginatedListLimitField,
  paginatedListPageField,
} from './query-preprocess.js';
import { type WorkItemListRow } from './work-items.js';

/**
 * Labels → Columns group-by fields backed by `work_item_chart_rollups`.
 * UI ids `board` / `owner` map to rollup `project_id` / `assignee_id`.
 * Unsupported UI fields (`group`, `name`, `dueDate`) are not accepted here.
 */
export const CHART_SERIES_LABEL_FIELDS = [
  'status',
  'owner',
  'board',
  'type',
  'priority',
] as const;

export type ChartSeriesLabelField = (typeof CHART_SERIES_LABEL_FIELDS)[number];

/** Rollup / work_items column used for a series label field. */
export type ChartRollupGroupColumn =
  'status' | 'assignee_id' | 'project_id' | 'type' | 'priority';

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
    case 'type':
      return 'type';
    case 'priority':
      return 'priority';
  }
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

const chartAnalyticsFilterFields = {
  projectId: z.uuid(),
  labelField: z.preprocess(
    (value) => (value === undefined || value === '' ? 'status' : value),
    z.enum(CHART_SERIES_LABEL_FIELDS)
  ),
  from: optionalDateOnly,
  to: optionalDateOnly,
  sprintId: optionalUuid,
} as const;

export const chartSeriesQuerySchema = z
  .object(chartAnalyticsFilterFields)
  .refine((query) => !(query.from && query.to) || query.from <= query.to, {
    message: '`from` must be on or before `to`',
    path: ['from'],
  });

export type ChartSeriesQuery = z.infer<typeof chartSeriesQuerySchema>;

export const chartDrilldownQuerySchema = z
  .object({
    ...chartAnalyticsFilterFields,
    /** Dimension value; empty string selects NULL (e.g. unassigned). */
    sliceKey: z.string(),
    page: paginatedListPageField,
    limit: paginatedListLimitField(20, 100),
  })
  .refine((query) => !(query.from && query.to) || query.from <= query.to, {
    message: '`from` must be on or before `to`',
    path: ['from'],
  });

export type ChartDrilldownQuery = z.infer<typeof chartDrilldownQuerySchema>;

export type ChartSeriesSlice = {
  /** Stable bucket id; empty string = NULL dimension. */
  key: string;
  /** Display label (status/type/priority value, user name, or project name). */
  label: string;
  count: number;
};

export type ChartSeriesResponse = {
  projectId: string;
  labelField: ChartSeriesLabelField;
  from?: string;
  to?: string;
  sprintId?: string;
  slices: ChartSeriesSlice[];
  totalCount: number;
};

/** Drilldown rows reuse the compact work-item list select. */
export { workItemListSelect as chartDrilldownItemSelect } from './work-items.js';

export type ChartDrilldownResponse = {
  projectId: string;
  labelField: ChartSeriesLabelField;
  sliceKey: string;
  workItems: WorkItemListRow[];
  totalCount: number;
  page: number;
  limit: number;
  totalPages: number;
};
