import { apiFetch } from '@/lib/api/api-fetch.reads.use.server';
import type { ChartWorkspaceRecord } from '@/app/charts/_components/charts.types';
import {
  chartOwnershipForViewer,
  chartWorkspaceFromApiRow,
  type ChartApiRow,
} from '@/app/charts/_helpers/charts-workspace-map';

/**
 * Owned charts for the registry (RSC). Mutations still go through `/api/charts`.
 */
export async function listOwnedChartWorkspaces(
  viewerId: string
): Promise<ChartWorkspaceRecord[]> {
  const result = await apiFetch<{ data: ChartApiRow[] }>('/api/charts', {
    method: 'GET',
  });
  return (result.data ?? []).map((row) =>
    chartWorkspaceFromApiRow(row, chartOwnershipForViewer(row, viewerId))
  );
}

/** Accessible chart board (owner or share recipient). */
export async function getAccessibleChartWorkspace(
  chartId: string,
  viewerId: string
): Promise<ChartWorkspaceRecord | null> {
  try {
    const result = await apiFetch<{ data: ChartApiRow }>(
      `/api/charts/${chartId}`,
      { method: 'GET' }
    );
    if (!result.data) {
      return null;
    }
    return chartWorkspaceFromApiRow(
      result.data,
      chartOwnershipForViewer(result.data, viewerId)
    );
  } catch {
    return null;
  }
}
