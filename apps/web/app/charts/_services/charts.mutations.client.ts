import { apiFetch } from '@/lib/api/api-fetch.mutations.use.client';
import type { ChartWorkspaceRecord } from '@/app/charts/_components/charts.types';
import {
  chartWorkspaceFromApiRow,
  getChartFromApi,
  listChartsFromApi,
  type ChartApiRow,
} from '@/app/charts/_services/charts.workspaces.client';

function boardJsonFromWorkspace(workspace: ChartWorkspaceRecord) {
  return {
    instances: workspace.instances,
    layout: workspace.layout,
  };
}

/** Upsert local workspace into API `charts` (best-effort). */
export async function syncChartWorkspaceToApi(
  workspace: ChartWorkspaceRecord
): Promise<ChartApiRow | null> {
  if (workspace.ownership === 'shared') {
    return null;
  }

  try {
    const existing = await getChartFromApi(workspace.id);

    if (existing) {
      const updated = await apiFetch<{ data: ChartApiRow }>(
        `/api/charts/${workspace.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            title: workspace.title,
            description: workspace.description,
            board_json: boardJsonFromWorkspace(workspace),
            is_overview: workspace.isOverview,
            status: workspace.status,
          }),
        }
      );
      return updated.data;
    }

    const created = await apiFetch<{ data: ChartApiRow }>('/api/charts', {
      method: 'POST',
      body: JSON.stringify({
        id: workspace.id,
        title: workspace.title,
        description: workspace.description,
        board_json: boardJsonFromWorkspace(workspace),
        is_overview: workspace.isOverview,
      }),
    });
    return created.data;
  } catch {
    return null;
  }
}

/** Share a chart workspace; optionally bookmark `/charts/[id]` as a saved view. */
export async function shareChartWorkspace(params: {
  readonly chartId: string;
  readonly userIds: readonly string[];
  readonly createSavedViewBookmark?: boolean;
}): Promise<{ sharedCount: number } | null> {
  try {
    const result = await apiFetch<{
      data: { sharedCount: number };
    }>(`/api/charts/${params.chartId}/share`, {
      method: 'POST',
      body: JSON.stringify({
        userIds: params.userIds,
        createSavedViewBookmark: params.createSavedViewBookmark ?? true,
      }),
    });
    return { sharedCount: result.data.sharedCount };
  } catch {
    return null;
  }
}

export { chartWorkspaceFromApiRow, listChartsFromApi };
