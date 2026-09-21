import type {
  ChartWorkspaceRecord,
  ChartWorkspacesStore,
} from '@/app/charts/_components/charts.types';
import {
  ensureDefaultChartWorkspace,
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
      await syncChartWorkspaceToApi(workspace);
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

function offlineFallbackStore(
  userId: string,
  local: ChartWorkspacesStore
): ChartWorkspacesStore {
  if (local.workspaces.length > 0) {
    return local;
  }
  const fallback = ensureDefaultChartWorkspace(userId);
  return {
    workspaces: [fallback],
    lastOpenedId: readChartWorkspacesStore(userId).lastOpenedId,
  };
}

async function createDefaultCloudWorkspace(
  userId: string
): Promise<ChartWorkspaceRecord[]> {
  const created = ensureDefaultChartWorkspace(userId);
  const synced = await syncChartWorkspaceToApi(created);
  if (synced) {
    return [chartWorkspaceFromApiRow(synced, 'mine')];
  }
  return [{ ...created, ownership: 'mine' }];
}

/**
 * Load owned + shared charts from the API, migrate any local-only boards,
 * and rewrite the local cache so cloud is the source of truth.
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
    return offlineFallbackStore(userId, local);
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

  let workspaces = [
    ...ownedRows.map((row) => chartWorkspaceFromApiRow(row, 'mine')),
    ...sharedRows.map((row) => chartWorkspaceFromApiRow(row, 'shared')),
  ];

  if (workspaces.length === 0) {
    workspaces = await createDefaultCloudWorkspace(userId);
  }

  const next: ChartWorkspacesStore = {
    workspaces,
    lastOpenedId: resolveLastOpenedId(local.lastOpenedId, workspaces),
  };
  writeChartWorkspacesStore(userId, next);
  return next;
}
