import type {
  ChartWorkspaceRecord,
  ChartWorkspacesStore,
} from '@/app/charts/_components/charts.types';
import {
  readChartWorkspacesStore,
  writeChartWorkspacesStore,
} from '@/app/charts/_helpers/charts-workspace-storage';
import { syncChartWorkspaceToApi } from '@/app/charts/_services/charts.mutations.client';
import {
  chartWorkspaceFromApiRow,
  listChartsFromApi,
  type ChartApiRow,
} from '@/app/charts/_services/charts.workspaces.client';

async function fetchOwnedAndSharedCharts(): Promise<{
  ownedRows: ChartApiRow[];
  sharedRows: ChartApiRow[];
}> {
  const [ownedRows, sharedRows] = await Promise.all([
    listChartsFromApi({ scope: 'owned' }),
    listChartsFromApi({ scope: 'shared' }),
  ]);
  return { ownedRows, sharedRows };
}

async function migrateLocalOnlyWorkspaces(
  localWorkspaces: readonly ChartWorkspaceRecord[],
  ownedIds: ReadonlySet<string>
): Promise<void> {
  for (const workspace of localWorkspaces) {
    if ((workspace.ownership ?? 'mine') === 'shared') {
      continue;
    }
    if (!ownedIds.has(workspace.id)) {
      try {
        await syncChartWorkspaceToApi(workspace);
      } catch {
        // Session expiry opens the dialog; other errors are best-effort.
        return;
      }
    }
  }
}

function resolveLastOpenedId(
  localLastOpenedId: string | null,
  workspaces: readonly ChartWorkspaceRecord[]
): string | null {
  if (
    localLastOpenedId &&
    workspaces.some((item) => item.id === localLastOpenedId)
  ) {
    return localLastOpenedId;
  }
  return workspaces[0]?.id ?? null;
}

/**
 * Prefer API rows, but keep any local-only owned boards that failed to sync
 * so hydrate never erases the URL the user is currently on.
 */
function mergeApiAndLocalOnly(
  apiWorkspaces: readonly ChartWorkspaceRecord[],
  local: ChartWorkspacesStore
): ChartWorkspaceRecord[] {
  const apiIds = new Set(apiWorkspaces.map((row) => row.id));
  const localOnly = local.workspaces.filter(
    (workspace) =>
      (workspace.ownership ?? 'mine') === 'mine' && !apiIds.has(workspace.id)
  );
  return [...apiWorkspaces, ...localOnly];
}

/**
 * Load owned + shared charts from the API, migrate any local-only boards,
 * and rewrite the local cache so cloud is the source of truth.
 * Does not create a default workspace when the list is empty.
 */
export async function hydrateChartWorkspacesFromApi(
  userId: string
): Promise<ChartWorkspacesStore> {
  if (!userId) {
    return { workspaces: [], lastOpenedId: null };
  }

  const local = readChartWorkspacesStore(userId);

  let ownedRows: ChartApiRow[] = [];
  let sharedRows: ChartApiRow[] = [];
  try {
    ({ ownedRows, sharedRows } = await fetchOwnedAndSharedCharts());
  } catch {
    return local;
  }

  await migrateLocalOnlyWorkspaces(
    local.workspaces,
    new Set(ownedRows.map((row) => row.id))
  );

  try {
    ownedRows = await listChartsFromApi({ scope: 'owned' });
  } catch {
    // Keep first fetch.
  }

  const fromApi = [
    ...ownedRows.map((row) => chartWorkspaceFromApiRow(row, 'mine')),
    ...sharedRows.map((row) => chartWorkspaceFromApiRow(row, 'shared')),
  ];

  const workspaces = mergeApiAndLocalOnly(fromApi, local);

  const next: ChartWorkspacesStore = {
    workspaces,
    lastOpenedId: resolveLastOpenedId(local.lastOpenedId, workspaces),
  };
  writeChartWorkspacesStore(userId, next);
  return next;
}
