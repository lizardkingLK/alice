import type {
  ChartDrilldownQuery,
  ChartDrilldownResponse,
  ChartHierarchyDrilldownQuery,
  ChartHierarchyDrilldownResponse,
  ChartHierarchySeriesQuery,
  ChartHierarchySeriesResponse,
  ChartSeriesQuery,
  ChartSeriesResponse,
} from '@repo/types';
import { apiFetch } from '@/lib/api/api-fetch.reads.use.client';

const SERIES_PATH = '/api/v1/charts/analytics/series';
const DRILLDOWN_PATH = '/api/v1/charts/analytics/drilldown';
const HIERARCHY_SERIES_PATH = '/api/v1/charts/analytics/hierarchy-series';
const HIERARCHY_DRILLDOWN_PATH = '/api/v1/charts/analytics/hierarchy-drilldown';

type AnalyticsQueryParams = Record<string, string | number | undefined>;

function toSearchParams(query: AnalyticsQueryParams): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) {
      continue;
    }
    params.set(key, String(value));
  }
  return params.toString();
}

/** Shared project/sprint/date/dimension params for all chart analytics GETs. */
function chartScopeQueryParams(query: {
  readonly projectId?: string;
  readonly from?: string;
  readonly to?: string;
  readonly sprintId?: string;
  readonly status?: string;
  readonly type?: string;
  readonly priority?: string;
  readonly assigneeId?: string;
}): AnalyticsQueryParams {
  return {
    projectId: query.projectId,
    from: query.from,
    to: query.to,
    sprintId: query.sprintId,
    status: query.status,
    type: query.type,
    priority: query.priority,
    assigneeId: query.assigneeId,
  };
}

async function fetchChartAnalytics<T>(
  path: string,
  query: AnalyticsQueryParams
): Promise<T> {
  const search = toSearchParams(query);
  const result = await apiFetch<{ data: T }>(`${path}?${search}`);
  return result.data;
}

/** Live pie series from `work_item_chart_rollups`. */
export async function fetchChartSeries(
  query: ChartSeriesQuery
): Promise<ChartSeriesResponse> {
  return fetchChartAnalytics(SERIES_PATH, {
    ...chartScopeQueryParams(query),
    labelField: query.labelField,
  });
}

/** Paginated work items for a pie-slice drilldown. */
export async function fetchChartDrilldown(
  query: ChartDrilldownQuery
): Promise<ChartDrilldownResponse> {
  return fetchChartAnalytics(DRILLDOWN_PATH, {
    ...chartScopeQueryParams(query),
    labelField: query.labelField,
    sliceKey: query.sliceKey,
    page: query.page,
    limit: query.limit,
  });
}

/** Nested-donut series from `work_item_chart_hierarchy_rollups`. */
export async function fetchChartHierarchySeries(
  query: ChartHierarchySeriesQuery
): Promise<ChartHierarchySeriesResponse> {
  return fetchChartAnalytics(HIERARCHY_SERIES_PATH, {
    ...chartScopeQueryParams(query),
    measure: query.measure,
    rootWorkItemId: query.rootWorkItemId,
  });
}

/** Paginated work items for a nested-donut slice drilldown. */
export async function fetchChartHierarchyDrilldown(
  query: ChartHierarchyDrilldownQuery
): Promise<ChartHierarchyDrilldownResponse> {
  return fetchChartAnalytics(HIERARCHY_DRILLDOWN_PATH, {
    ...chartScopeQueryParams(query),
    measure: query.measure,
    rootWorkItemId: query.rootWorkItemId,
    ring: query.ring,
    sliceKey: query.sliceKey,
    parentKey: query.parentKey,
    page: query.page,
    limit: query.limit,
  });
}
