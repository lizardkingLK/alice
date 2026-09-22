import type { LayoutItem } from 'react-grid-layout';
import type {
  ChartBoardWidgetInstance,
  ChartWorkspaceRecord,
  ChartWorkspacesStore,
} from '@/app/charts/_components/charts.types';
import {
  getLocalStorageJson,
  removeLocalStorageItem,
  setLocalStorageJson,
} from '@/lib/local-storage';

const LEGACY_LAYOUT_KEY = 'alice.charts.board.layout.v1';
const LEGACY_INSTANCES_KEY = 'alice.charts.board.instances.v1';
const STORE_PREFIX = 'alice.charts.workspaces.v1:';

function storeKey(userId: string) {
  return `${STORE_PREFIX}${userId}`;
}

export function createChartWorkspaceId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `chart-${Date.now()}`;
}

function emptyStore(): ChartWorkspacesStore {
  return { workspaces: [], lastOpenedId: null };
}

function isWorkspaceRecord(value: unknown): value is ChartWorkspaceRecord {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === 'string' &&
    typeof record.title === 'string' &&
    (record.status === 'active' || record.status === 'archived') &&
    typeof record.isOverview === 'boolean' &&
    typeof record.updatedAt === 'string' &&
    Array.isArray(record.instances) &&
    Array.isArray(record.layout)
  );
}

function parseStore(value: unknown): ChartWorkspacesStore | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (!Array.isArray(record.workspaces)) {
    return null;
  }
  const workspaces = record.workspaces.filter(isWorkspaceRecord);
  const lastOpenedId =
    typeof record.lastOpenedId === 'string' ? record.lastOpenedId : null;
  return { workspaces, lastOpenedId };
}

function nextDefaultTitle(existingTitles: readonly string[]): string {
  const base = 'Charts';
  if (!existingTitles.includes(base)) {
    return base;
  }
  let index = 2;
  while (existingTitles.includes(`${base} (${index})`)) {
    index += 1;
  }
  return `${base} (${index})`;
}

function migrateLegacyBoard(): ChartWorkspaceRecord | null {
  const instances =
    getLocalStorageJson<ChartBoardWidgetInstance[]>(LEGACY_INSTANCES_KEY) ?? [];
  const layout = getLocalStorageJson<LayoutItem[]>(LEGACY_LAYOUT_KEY) ?? [];
  if (!Array.isArray(instances) || !Array.isArray(layout)) {
    return null;
  }
  if (instances.length === 0 && layout.length === 0) {
    return null;
  }

  removeLocalStorageItem(LEGACY_LAYOUT_KEY);
  removeLocalStorageItem(LEGACY_INSTANCES_KEY);

  return {
    id: createChartWorkspaceId(),
    title: 'Charts',
    description: null,
    status: 'active',
    isOverview: false,
    ownership: 'mine',
    updatedAt: new Date().toISOString(),
    instances,
    layout,
  };
}

export function readChartWorkspacesStore(userId: string): ChartWorkspacesStore {
  if (!userId) {
    return emptyStore();
  }

  const parsed = parseStore(getLocalStorageJson(storeKey(userId)));
  if (parsed && parsed.workspaces.length > 0) {
    return parsed;
  }

  const legacy = migrateLegacyBoard();
  if (legacy) {
    const store: ChartWorkspacesStore = {
      workspaces: [legacy],
      lastOpenedId: legacy.id,
    };
    setLocalStorageJson(storeKey(userId), store);
    return store;
  }

  return parsed ?? emptyStore();
}

export function writeChartWorkspacesStore(
  userId: string,
  store: ChartWorkspacesStore
): void {
  if (!userId) {
    return;
  }
  setLocalStorageJson(storeKey(userId), store);
}

export function ensureDefaultChartWorkspace(
  userId: string
): ChartWorkspaceRecord {
  const store = readChartWorkspacesStore(userId);
  if (store.workspaces.length > 0) {
    const last =
      store.workspaces.find((item) => item.id === store.lastOpenedId) ??
      store.workspaces[0];
    return last!;
  }

  const workspace: ChartWorkspaceRecord = {
    id: createChartWorkspaceId(),
    title: 'Charts',
    description: null,
    status: 'active',
    isOverview: false,
    ownership: 'mine',
    updatedAt: new Date().toISOString(),
    instances: [],
    layout: [],
  };
  writeChartWorkspacesStore(userId, {
    workspaces: [workspace],
    lastOpenedId: workspace.id,
  });
  return workspace;
}

export function getChartWorkspace(
  userId: string,
  workspaceId: string
): ChartWorkspaceRecord | null {
  const store = readChartWorkspacesStore(userId);
  return store.workspaces.find((item) => item.id === workspaceId) ?? null;
}

export function setLastOpenedChartWorkspace(
  userId: string,
  workspaceId: string
): void {
  const store = readChartWorkspacesStore(userId);
  if (!store.workspaces.some((item) => item.id === workspaceId)) {
    return;
  }
  writeChartWorkspacesStore(userId, {
    ...store,
    lastOpenedId: workspaceId,
  });
}

export function upsertChartWorkspace(
  userId: string,
  workspace: ChartWorkspaceRecord
): ChartWorkspacesStore {
  const store = readChartWorkspacesStore(userId);
  const index = store.workspaces.findIndex((item) => item.id === workspace.id);
  const nextWorkspaces = [...store.workspaces];
  if (index >= 0) {
    nextWorkspaces[index] = workspace;
  } else {
    nextWorkspaces.push(workspace);
  }

  let workspaces = nextWorkspaces;
  if (workspace.isOverview) {
    workspaces = nextWorkspaces.map((item) =>
      item.id === workspace.id ? item : { ...item, isOverview: false }
    );
  }

  const next: ChartWorkspacesStore = {
    workspaces,
    lastOpenedId: store.lastOpenedId ?? workspace.id,
  };
  writeChartWorkspacesStore(userId, next);
  return next;
}

export function createChartWorkspace(
  userId: string,
  options?: {
    readonly title?: string;
    readonly isOverview?: boolean;
  }
): ChartWorkspaceRecord {
  const store = readChartWorkspacesStore(userId);
  const resolvedTitle =
    options?.title?.trim() ||
    nextDefaultTitle(store.workspaces.map((item) => item.title));
  const wantsOverview = options?.isOverview === true;
  const workspace: ChartWorkspaceRecord = {
    id: createChartWorkspaceId(),
    title: resolvedTitle,
    description: null,
    status: 'active',
    isOverview: wantsOverview,
    ownership: 'mine',
    updatedAt: new Date().toISOString(),
    instances: [],
    layout: [],
  };
  const cleared = wantsOverview
    ? store.workspaces.map((item) =>
        item.isOverview ? { ...item, isOverview: false } : item
      )
    : store.workspaces;
  writeChartWorkspacesStore(userId, {
    workspaces: [...cleared, workspace],
    lastOpenedId: workspace.id,
  });
  return workspace;
}

export function saveChartWorkspaceBoard(
  userId: string,
  workspaceId: string,
  board: {
    readonly instances: ChartBoardWidgetInstance[];
    readonly layout: LayoutItem[];
  }
): ChartWorkspaceRecord | null {
  const existing = getChartWorkspace(userId, workspaceId);
  if (!existing) {
    return null;
  }
  const updated: ChartWorkspaceRecord = {
    ...existing,
    instances: board.instances,
    layout: board.layout,
    updatedAt: new Date().toISOString(),
  };
  upsertChartWorkspace(userId, updated);
  return updated;
}

export function renameChartWorkspaceMeta(
  userId: string,
  workspaceId: string,
  patch: {
    readonly title?: string;
    readonly isOverview?: boolean;
    readonly status?: 'active' | 'archived';
  }
): ChartWorkspaceRecord | null {
  const existing = getChartWorkspace(userId, workspaceId);
  if (!existing) {
    return null;
  }
  const updated: ChartWorkspaceRecord = {
    ...existing,
    title: patch.title?.trim() || existing.title,
    isOverview: patch.isOverview ?? existing.isOverview,
    status: patch.status ?? existing.status,
    updatedAt: new Date().toISOString(),
  };
  upsertChartWorkspace(userId, updated);
  return updated;
}

/**
 * Remove a workspace from the local cache.
 * Returns the next workspace to open (last remaining active/owned preference),
 * or `null` when the store is empty after removal.
 */
export function removeChartWorkspace(
  userId: string,
  workspaceId: string
): ChartWorkspaceRecord | null {
  const store = readChartWorkspacesStore(userId);
  const nextWorkspaces = store.workspaces.filter(
    (item) => item.id !== workspaceId
  );
  if (nextWorkspaces.length === store.workspaces.length) {
    return null;
  }

  const preferred =
    nextWorkspaces.find((item) => item.id === store.lastOpenedId) ??
    nextWorkspaces.find((item) => item.status === 'active') ??
    nextWorkspaces[0] ??
    null;

  writeChartWorkspacesStore(userId, {
    workspaces: nextWorkspaces,
    lastOpenedId: preferred?.id ?? null,
  });
  return preferred;
}

export function listChartWorkspaces(
  userId: string,
  filters?: {
    readonly ownership?: 'all' | 'mine' | 'shared';
    readonly status?: 'all' | 'active' | 'archived';
    readonly search?: string;
  }
): ChartWorkspaceRecord[] {
  const store = readChartWorkspacesStore(userId);
  const ownership = filters?.ownership ?? 'all';
  const status = filters?.status ?? 'all';
  const search = filters?.search?.trim().toLowerCase() ?? '';

  return store.workspaces.filter((workspace) => {
    const workspaceOwnership = workspace.ownership ?? 'mine';
    if (ownership === 'mine' && workspaceOwnership !== 'mine') {
      return false;
    }
    if (ownership === 'shared' && workspaceOwnership !== 'shared') {
      return false;
    }
    if (status !== 'all' && workspace.status !== status) {
      return false;
    }
    if (search && !workspace.title.toLowerCase().includes(search)) {
      return false;
    }
    return true;
  });
}

export function suggestChartWorkspaceTitle(userId: string): string {
  const store = readChartWorkspacesStore(userId);
  return nextDefaultTitle(store.workspaces.map((item) => item.title));
}
