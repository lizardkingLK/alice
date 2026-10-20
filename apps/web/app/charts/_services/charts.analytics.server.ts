import type { ChartSeriesQuery, ChartSeriesResponse } from '@repo/types';
import { apiFetch } from '@/lib/api/api-fetch.reads.use.server';

const SERIES_PATH = '/api/v1/charts/analytics/series';

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

/** RSC twin of client `fetchChartSeries` — seeds dashboard widget caches. */
export async function fetchChartSeriesServer(
  query: ChartSeriesQuery
): Promise<ChartSeriesResponse> {
  const search = toSearchParams({
    projectId: query.projectId,
    from: query.from,
    to: query.to,
    sprintId: query.sprintId,
    status: query.status,
    type: query.type,
    priority: query.priority,
    assigneeId: query.assigneeId,
    labelField: query.labelField,
  });
  const result = await apiFetch<{ data: ChartSeriesResponse }>(
    `${SERIES_PATH}?${search}`
  );
  return result.data;
}
