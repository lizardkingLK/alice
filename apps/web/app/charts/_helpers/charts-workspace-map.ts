import type { LayoutItem } from 'react-grid-layout';
import type {
  ChartBoardWidgetInstance,
  ChartWorkspaceRecord,
  ChartWorkspaceScope,
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

function parseWorkspaceScope(value: unknown): ChartWorkspaceScope | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const record = value as Record<string, unknown>;
  const projectId =
    typeof record.projectId === 'string' ? record.projectId.trim() : '';
  const sprintId =
    typeof record.sprintId === 'string' ? record.sprintId.trim() : '';
  if (!projectId || !sprintId) {
    return null;
  }
  return { projectId, sprintId };
}

function parseBoardJson(value: unknown): {
  instances: ChartBoardWidgetInstance[];
  layout: LayoutItem[];
  scope: ChartWorkspaceScope | null;
} {
  if (!value || typeof value !== 'object') {
    return { instances: [], layout: [], scope: null };
  }
  const record = value as Record<string, unknown>;
  const instances = Array.isArray(record.instances)
    ? (record.instances as ChartBoardWidgetInstance[])
    : [];
  const layout = Array.isArray(record.layout)
    ? (record.layout as LayoutItem[])
    : [];
  return {
    instances,
    layout,
    scope: parseWorkspaceScope(record.scope),
  };
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
    scope: board.scope,
  };
}

export function chartOwnershipForViewer(
  row: Pick<ChartApiRow, 'owner_id'>,
  viewerId: string
): 'mine' | 'shared' {
  return row.owner_id === viewerId ? 'mine' : 'shared';
}
