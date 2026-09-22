import { apiFetch } from '@/lib/api/api-fetch.mutations.use.client';
import { isSessionExpiredError } from '@/lib/errors/session-expired';
import type { ChartWorkspaceRecord } from '@/app/charts/_components/charts.types';
import {
  chartOwnershipForViewer,
  chartWorkspaceFromApiRow,
  type ChartApiRow,
} from '@/app/charts/_helpers/charts-workspace-map';

export {
  chartWorkspaceFromApiRow,
  listChartsFromApi,
} from '@/app/charts/_services/charts.workspaces.client';

function boardJsonFromWorkspace(workspace: ChartWorkspaceRecord) {
  return {
    instances: workspace.instances,
    layout: workspace.layout,
  };
}

type ChartMutationSuccess = { readonly success: true };

/**
 * Persist board / meta to API `charts` (best-effort upsert via POST).
 * Re-throws session expiry; other failures return `null`.
 */
export async function syncChartWorkspaceToApi(
  workspace: ChartWorkspaceRecord
): Promise<ChartApiRow | null> {
  if (workspace.ownership === 'shared') {
    return null;
  }

  try {
    const result = await apiFetch<{ data: ChartApiRow }>('/api/charts', {
      method: 'POST',
      body: JSON.stringify({
        id: workspace.id,
        title: workspace.title,
        description: workspace.description,
        board_json: boardJsonFromWorkspace(workspace),
        is_overview: workspace.isOverview,
      }),
    });
    return result.data;
  } catch (error) {
    if (isSessionExpiredError(error)) {
      throw error;
    }
    return null;
  }
}

/** Create a new owned chart workspace on the server. */
export async function createChartWorkspaceOnApi(params: {
  readonly title: string;
  readonly isOverview?: boolean;
  readonly viewerId: string;
}): Promise<ChartWorkspaceRecord> {
  const result = await apiFetch<{ data: ChartApiRow }>('/api/charts', {
    method: 'POST',
    body: JSON.stringify({
      title: params.title,
      is_overview: params.isOverview ?? false,
      board_json: { instances: [], layout: [] },
    }),
  });
  return chartWorkspaceFromApiRow(
    result.data,
    chartOwnershipForViewer(result.data, params.viewerId)
  );
}

export async function archiveChartWorkspace(
  chartId: string
): Promise<ChartApiRow> {
  const result = await apiFetch<{ data: ChartApiRow }>(
    `/api/charts/${chartId}/archive`,
    { method: 'POST' }
  );
  return result.data;
}

export async function restoreChartWorkspace(
  chartId: string
): Promise<ChartApiRow> {
  const result = await apiFetch<{ data: ChartApiRow }>(
    `/api/charts/${chartId}/restore`,
    { method: 'POST' }
  );
  return result.data;
}

/** Permanently delete an owned chart (active or archived). */
export async function deleteChartWorkspace(chartId: string): Promise<void> {
  await apiFetch<ChartMutationSuccess>(`/api/charts/${chartId}`, {
    method: 'DELETE',
  });
}

/** Leave a shared chart (deletes the recipient’s share row only). */
export async function leaveSharedChartWorkspace(
  chartId: string
): Promise<void> {
  await apiFetch<ChartMutationSuccess>(`/api/charts/${chartId}/share`, {
    method: 'DELETE',
  });
}
