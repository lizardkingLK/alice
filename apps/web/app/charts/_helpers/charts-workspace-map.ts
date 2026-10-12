import type { LayoutItem } from 'react-grid-layout';
import type {
  ChartBoardWidgetInstance,
  ChartWorkspaceRecord,
} from '@/app/charts/_components/charts.types';

/** Wire row from `GET /api/charts` (owned, shared, or dashboard). */
export type ChartApiRow = {
  readonly id: string;
  readonly owner_id: string;
  readonly title: string;
  readonly description: string | null;
  readonly board_json: unknown;
  readonly show_on_dashboard: boolean;
  readonly dashboard_sort_order: number;
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
    showOnDashboard: row.show_on_dashboard,
    dashboardSortOrder: row.dashboard_sort_order,
    updatedAt: row.updated_at,
    ownership,
    instances: board.instances,
    layout: board.layout,
  };
}

export function chartOwnershipForViewer(
  row: Pick<ChartApiRow, 'owner_id'>,
  viewerId: string
): 'mine' | 'shared' {
  return row.owner_id === viewerId ? 'mine' : 'shared';
}
