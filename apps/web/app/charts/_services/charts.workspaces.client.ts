import { apiFetch } from '@/lib/api/api-fetch.mutations.use.client';
import type {
  ChartBoardWidgetInstance,
  ChartWorkspaceRecord,
} from '@/app/charts/_components/charts.types';
import type { LayoutItem } from 'react-grid-layout';

export type ChartApiRow = {
  readonly id: string;
  readonly title: string;
  readonly description: string | null;
  readonly board_json: unknown;
  readonly is_overview: boolean;
  readonly status: string;
  readonly updated_at: string;
};

function parseBoardJson(value: unknown): {
  instances: ChartBoardWidgetInstance[];
  layout: LayoutItem[];
} {
  if (!value || typeof value !== 'object') {
    return { instances: [], layout: [] };
  }
  const record = value as Record<string, unknown>;
  const instances = Array.isArray(record.instances)
    ? (record.instances as ChartBoardWidgetInstance[])
    : [];
  const layout = Array.isArray(record.layout)
    ? (record.layout as LayoutItem[])
    : [];
  return { instances, layout };
}

export function chartWorkspaceFromApiRow(
  row: ChartApiRow,
  ownership: 'mine' | 'shared'
): ChartWorkspaceRecord {
  const board = parseBoardJson(row.board_json);
  const status = row.status === 'archived' ? 'archived' : 'active';
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status,
    isOverview: row.is_overview,
    updatedAt: row.updated_at,
    ownership,
    instances: board.instances,
    layout: board.layout,
  };
}

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
