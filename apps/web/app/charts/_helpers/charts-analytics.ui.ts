import type { ChartConfig } from '@repo/ui/components/ui/chart';
import {
  CHART_SERIES_LABEL_FIELDS,
  CHART_SERIES_NULL_SLICE_KEY,
  type ChartSeriesLabelField,
  type ChartSeriesQuery,
  type ChartSeriesSlice,
  type WorkItemListRow,
  type WorkItemStatus,
} from '@repo/types';
import { BOARD_WORK_ITEM_STATUSES } from '@repo/types';
import { STATUS_META } from '@/app/work-items/_helpers/work-item-status';
import { STATUS_CHART_COLORS } from '@/components/status-distribution-wheel';
import type {
  ChartsLabelFieldId,
  ChartsWidgetFilterDraft,
  ChartsStatusPieSlice,
} from '@/app/charts/_components/charts-sample.data';

const CHART_TOKEN_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
] as const;

const FALLBACK_STATUS_COLOR = 'var(--muted-foreground)';

const LIVE_LABEL_FIELD_SET = new Set<string>(CHART_SERIES_LABEL_FIELDS);

/** Labels columns backed by the Tier 1 series API. */
export const CHARTS_LIVE_LABEL_COLUMNS: readonly {
  readonly id: ChartSeriesLabelField;
  readonly label: string;
}[] = [
  { id: 'board', label: 'Project' },
  { id: 'owner', label: 'Owner' },
  { id: 'status', label: 'Status' },
  { id: 'type', label: 'Type' },
  { id: 'priority', label: 'Priority' },
] as const;

export function isChartSeriesLabelField(
  value: ChartsLabelFieldId
): value is ChartSeriesLabelField {
  return LIVE_LABEL_FIELD_SET.has(value);
}

/** Concrete project UUID from widget filters, or null when unset / “all”. */
export function resolveChartAnalyticsProjectId(
  filters: ChartsWidgetFilterDraft | null | undefined
): string | null {
  if (!filters) {
    return null;
  }
  /**
   * Quick filters store the project under `quickSelections.project`; advanced
   * uses top-level `projectId`. Prefer the active mode’s source of truth.
   */
  const projectId =
    filters.mode === 'quick'
      ? (filters.quickSelections.project ?? filters.projectId)
      : filters.projectId;
  if (!projectId || projectId === 'all') {
    return null;
  }
  return projectId;
}

/** Sprint UUID from widget filters when set. */
export function resolveChartAnalyticsSprintId(
  filters: ChartsWidgetFilterDraft | null | undefined
): string | undefined {
  if (!filters) {
    return undefined;
  }
  /**
   * Quick filters store sprint under `quickSelections.sprint`; advanced uses
   * top-level `sprintId`. Prefer the active mode’s source of truth.
   */
  const raw =
    filters.mode === 'quick'
      ? (filters.quickSelections.sprint ?? filters.sprintId)
      : filters.sprintId;
  const sprintId = raw?.trim();
  if (!sprintId || sprintId === 'all') {
    return undefined;
  }
  return sprintId;
}

export type ChartAnalyticsDimensionFilters = {
  readonly status?: ChartSeriesQuery['status'];
  readonly type?: ChartSeriesQuery['type'];
  readonly priority?: ChartSeriesQuery['priority'];
  /** Empty string = unassigned. */
  readonly assigneeId?: string;
};

/**
 * Map widget quick/advanced equality filters onto analytics query params.
 * Advanced rows only apply `is` conditions (same as Tier 1 rollup equality).
 */
export function resolveChartAnalyticsDimensionFilters(
  filters: ChartsWidgetFilterDraft | null | undefined
): ChartAnalyticsDimensionFilters {
  if (!filters) {
    return {};
  }

  const out: {
    status?: ChartAnalyticsDimensionFilters['status'];
    type?: ChartAnalyticsDimensionFilters['type'];
    priority?: ChartAnalyticsDimensionFilters['priority'];
    assigneeId?: string;
  } = {};

  const applyField = (field: string, value: string) => {
    if (!value || value === 'all') {
      return;
    }
    if (field === 'status') {
      out.status = value as ChartAnalyticsDimensionFilters['status'];
      return;
    }
    if (field === 'type') {
      out.type = value as ChartAnalyticsDimensionFilters['type'];
      return;
    }
    if (field === 'priority') {
      out.priority = value as ChartAnalyticsDimensionFilters['priority'];
      return;
    }
    if (field === 'assignee') {
      out.assigneeId = value === 'unassigned' ? '' : value;
    }
  };

  if (filters.mode === 'quick') {
    for (const [field, value] of Object.entries(filters.quickSelections)) {
      applyField(field, value);
    }
    return out;
  }

  for (const row of filters.rows) {
    if (row.condition !== 'is' || !row.value) {
      continue;
    }
    applyField(row.column, row.value);
  }
  return out;
}

function chartSafeKey(raw: string, index: number): string {
  const slug = raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 48);
  return slug.length > 0 ? `${slug}_${index}` : `bucket_${index}`;
}

function swatchForBucket(
  labelField: ChartSeriesLabelField,
  bucketKey: string,
  index: number
): string {
  if (labelField === 'status') {
    const statusColors = STATUS_CHART_COLORS as Partial<
      Record<WorkItemStatus, string>
    >;
    return statusColors[bucketKey as WorkItemStatus] ?? FALLBACK_STATUS_COLOR;
  }
  return CHART_TOKEN_COLORS[index % CHART_TOKEN_COLORS.length] as string;
}

function displayLabel(
  labelField: ChartSeriesLabelField,
  slice: ChartSeriesSlice
): string {
  if (slice.key === CHART_SERIES_NULL_SLICE_KEY) {
    return slice.label || 'Unassigned';
  }
  if (labelField === 'status') {
    return STATUS_META[slice.key as WorkItemStatus]?.label ?? slice.label;
  }
  return slice.label || slice.key;
}

/**
 * Build pie wheel data from live series slices (same shape as the former sample builder).
 */
export function buildChartsPieFromSeries(
  slices: readonly ChartSeriesSlice[],
  labelField: ChartSeriesLabelField
): {
  readonly data: ChartsStatusPieSlice[];
  readonly config: ChartConfig;
  readonly total: number;
} {
  const total = slices.reduce((sum, slice) => sum + slice.count, 0);

  let ordered = [...slices];
  if (labelField === 'status') {
    const byKey = new Map(slices.map((slice) => [slice.key, slice]));
    ordered = BOARD_WORK_ITEM_STATUSES.map((status) =>
      byKey.get(status)
    ).filter((slice): slice is ChartSeriesSlice => Boolean(slice));
    for (const slice of slices) {
      if (
        !(BOARD_WORK_ITEM_STATUSES as readonly string[]).includes(slice.key)
      ) {
        ordered.push(slice);
      }
    }
  }

  const data: ChartsStatusPieSlice[] = ordered.map((slice, index) => {
    const label = displayLabel(labelField, slice);
    const chartKey =
      labelField === 'status' && slice.key
        ? slice.key
        : chartSafeKey(slice.key || 'null', index);
    const swatch = swatchForBucket(labelField, slice.key, index);
    const percent =
      total === 0 ? '0%' : `${((slice.count / total) * 100).toFixed(1)}%`;
    return {
      status: chartKey,
      key: slice.key,
      label,
      count: slice.count,
      percent,
      fill: `var(--color-${chartKey})`,
      swatch,
    };
  });

  const config: ChartConfig = {
    count: { label: 'Tasks' },
  };
  for (const entry of data) {
    config[entry.status] = {
      label: entry.label,
      color: entry.swatch,
    };
  }

  return { data, config, total };
}

/** Compact row for the chart drilldown table. */
export type ChartDrilldownTableItem = {
  readonly id: string;
  readonly title: string;
  readonly status: WorkItemStatus;
  readonly type: WorkItemListRow['type'];
  readonly priority: WorkItemListRow['priority'];
  readonly assigneeId: string | null;
  readonly assigneeName: string | null;
  readonly assigneeAvatar: string | null;
  readonly projectId: string;
};

export function workItemListRowToChartTableItem(
  row: WorkItemListRow
): ChartDrilldownTableItem {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    type: row.type,
    priority: row.priority,
    assigneeId: row.assignee_id,
    assigneeName: row.assignee?.name ?? null,
    assigneeAvatar: row.assignee?.profile_picture ?? null,
    projectId: row.project_id,
  };
}

export function filterChartDrilldownTableItems(
  items: readonly ChartDrilldownTableItem[],
  options?: {
    readonly search?: string;
  }
): ChartDrilldownTableItem[] {
  const search = options?.search?.trim().toLowerCase() ?? '';
  if (!search) {
    return [...items];
  }

  return items.filter((item) => {
    if (item.title.toLowerCase().includes(search)) {
      return true;
    }
    const assigneeName = item.assigneeName?.toLowerCase() ?? '';
    return assigneeName.includes(search);
  });
}
