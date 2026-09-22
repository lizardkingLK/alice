import { apiFetch } from '@/lib/api/api-fetch.mutations.use.client';
import { isSessionExpiredError } from '@/lib/errors/session-expired';
import type { ChartWorkspaceRecord } from '@/app/charts/_components/charts.types';
import type { ChartApiRow } from '@/app/charts/_services/charts.workspaces.client';

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
 * Upsert local workspace into API `charts` (best-effort).
 * Always POSTs — the API updates when `id` already belongs to the caller.
 * Re-throws session expiry (dialog already emitted by `apiFetch`); other
 * failures return `null`. Fire-and-forget callers must `.catch(() => {})`.
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
  } catch (error) {
    if (isSessionExpiredError(error)) {
      throw error;
    }
    return null;
  }
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
