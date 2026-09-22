import { apiFetch } from '@/lib/api/api-fetch.mutations.use.client';
import type { ChartWorkspaceRecord } from '@/app/charts/_components/charts.types';
import {
  chartOwnershipForViewer,
  chartWorkspaceFromApiRow,
  type ChartApiRow,
} from '@/app/charts/_helpers/charts-workspace-map';

export type { ChartApiRow } from '@/app/charts/_helpers/charts-workspace-map';
export {
  chartOwnershipForViewer,
  chartWorkspaceFromApiRow,
} from '@/app/charts/_helpers/charts-workspace-map';

export async function listChartsFromApi(params?: {
  readonly scope?: 'owned' | 'shared';
  readonly status?: 'active' | 'archived';
}): Promise<ChartApiRow[]> {
  const search = new URLSearchParams();
  if (params?.scope === 'shared') {
    search.set('scope', 'shared');
  }
  if (params?.status) {
    search.set('status', params.status);
  }
  const query = search.toString();
  const path = query ? `/api/charts?${query}` : '/api/charts';
  const result = await apiFetch<{ data: ChartApiRow[] }>(path, {
    method: 'GET',
  });
  return result.data ?? [];
}

export async function getChartFromApi(
  chartId: string
): Promise<ChartApiRow | null> {
  try {
    const result = await apiFetch<{ data: ChartApiRow }>(
      `/api/charts/${chartId}`,
      { method: 'GET' }
    );
    return result.data ?? null;
  } catch {
    return null;
  }
}

export async function getChartWorkspaceFromApi(
  chartId: string,
  viewerId: string
): Promise<ChartWorkspaceRecord | null> {
  const row = await getChartFromApi(chartId);
  if (!row) {
    return null;
  }
  return chartWorkspaceFromApiRow(row, chartOwnershipForViewer(row, viewerId));
}
