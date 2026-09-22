import type {
  ChartDrilldownQuery,
  ChartDrilldownResponse,
  ChartSeriesQuery,
  ChartSeriesResponse,
} from '@repo/types';
import { apiFetch } from '@/lib/api/api-fetch.reads.use.client';

const SERIES_PATH = '/api/v1/charts/analytics/series';
const DRILLDOWN_PATH = '/api/v1/charts/analytics/drilldown';

function toSearchParams(
  query: Record<string, string | number | undefined>
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) {
      continue;
    }
    params.set(key, String(value));
  }
  return params.toString();
}

/** Live pie series from `work_item_chart_rollups`. */
export async function fetchChartSeries(
  query: ChartSeriesQuery
): Promise<ChartSeriesResponse> {
  const search = toSearchParams({
    projectId: query.projectId,
    labelField: query.labelField,
    from: query.from,
    to: query.to,
    sprintId: query.sprintId,
    status: query.status,
    type: query.type,
    priority: query.priority,
    assigneeId: query.assigneeId,
  });
  const result = await apiFetch<{ data: ChartSeriesResponse }>(
    `${SERIES_PATH}?${search}`
  );
  return result.data;
}

/** Paginated work items for a pie-slice drilldown. */
export async function fetchChartDrilldown(
  query: ChartDrilldownQuery
): Promise<ChartDrilldownResponse> {
  const search = toSearchParams({
    projectId: query.projectId,
    labelField: query.labelField,
    sliceKey: query.sliceKey,
    page: query.page,
    limit: query.limit,
    from: query.from,
    to: query.to,
    sprintId: query.sprintId,
    status: query.status,
    type: query.type,
    priority: query.priority,
    assigneeId: query.assigneeId,
  });
  const result = await apiFetch<{ data: ChartDrilldownResponse }>(
    `${DRILLDOWN_PATH}?${search}`
  );
  return result.data;
}
