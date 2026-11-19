import {
  normalizeProjectWorkItemTypeDefs,
  type ProjectWorkItemTypeDef,
} from '@repo/types';
import {
  getLocalStorageJson,
  removeLocalStorageItem,
  setLocalStorageJson,
} from '@/lib/local-storage';

export type WitCatalogProjectEntry = {
  readonly revision: string;
  readonly types: readonly ProjectWorkItemTypeDef[];
};

export type WitCatalogStore = {
  readonly projects: Record<string, WitCatalogProjectEntry>;
};

const STORAGE_PREFIX = 'alice:wit-catalog:v1:';

function storageKey(userId: string): string {
  return `${STORAGE_PREFIX}${userId}`;
}

export function catalogRevisionFromDefs(
  defs: readonly ProjectWorkItemTypeDef[]
): string {
  const normalized = [...defs]
    .sort((a, b) => a.level - b.level)
    .map(
      (def) =>
        `${def.key}|${def.name}|${def.icon}|${def.color ?? ''}|${def.level}|${def.description ?? ''}`
    )
    .join(';;');
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    hash = Math.trunc(hash * 31 + (normalized.codePointAt(i) ?? 0));
  }
  return `r${Math.abs(hash).toString(16)}`;
}

function isCatalogEntry(value: unknown): value is WitCatalogProjectEntry {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const record = value as Record<string, unknown>;
  if (typeof record.revision !== 'string' || record.revision.length === 0) {
    return false;
  }
  if (!Array.isArray(record.types)) {
    return false;
  }
  return normalizeProjectWorkItemTypeDefs(record.types).length > 0;
}

function normalizeStore(value: unknown): WitCatalogStore {
  if (!value || typeof value !== 'object') {
    return { projects: {} };
  }
  const record = value as Record<string, unknown>;
  const projectsRaw =
    record.projects && typeof record.projects === 'object'
      ? (record.projects as Record<string, unknown>)
      : {};
  const projects: Record<string, WitCatalogProjectEntry> = {};
  for (const [projectId, entry] of Object.entries(projectsRaw)) {
    if (!isCatalogEntry(entry)) {
      continue;
    }
    projects[projectId] = {
      revision: entry.revision,
      types: normalizeProjectWorkItemTypeDefs(entry.types),
    };
  }
  return { projects };
}

export function readWitCatalog(userId: string): WitCatalogStore {
  if (!userId) {
    return { projects: {} };
  }
  return normalizeStore(getLocalStorageJson(storageKey(userId)));
}

export function writeWitCatalog(
  userId: string,
  store: WitCatalogStore
): boolean {
  if (!userId) {
    return false;
  }
  return setLocalStorageJson(storageKey(userId), normalizeStore(store));
}

export function clearWitCatalog(userId: string): boolean {
  if (!userId) {
    return false;
  }
  return removeLocalStorageItem(storageKey(userId));
}

function normalizedCatalogEntry(
  entry: WitCatalogProjectEntry
): WitCatalogProjectEntry {
  return {
    revision: entry.revision,
    types: normalizeProjectWorkItemTypeDefs(entry.types),
  };
}

function shouldSkipCatalogEntry(
  existing: WitCatalogProjectEntry | undefined,
  entry: WitCatalogProjectEntry
): boolean {
  return existing?.revision === entry.revision;
}

export function upsertWitCatalogProject(
  userId: string,
  projectId: string,
  entry: WitCatalogProjectEntry
): WitCatalogStore {
  const current = readWitCatalog(userId);
  if (shouldSkipCatalogEntry(current.projects[projectId], entry)) {
    return current;
  }
  const next: WitCatalogStore = {
    projects: {
      ...current.projects,
      [projectId]: normalizedCatalogEntry(entry),
    },
  };
  writeWitCatalog(userId, next);
  return next;
}

export function mergeWitCatalogProjects(
  userId: string,
  entries: Record<string, WitCatalogProjectEntry>
): WitCatalogStore {
  const current = readWitCatalog(userId);
  let changed = false;
  const projects = { ...current.projects };
  for (const [projectId, entry] of Object.entries(entries)) {
    if (shouldSkipCatalogEntry(projects[projectId], entry)) {
      continue;
    }
    projects[projectId] = normalizedCatalogEntry(entry);
    changed = true;
  }
  if (!changed) {
    return current;
  }
  const next = { projects };
  writeWitCatalog(userId, next);
  return next;
}

export function resolveTypeFromWitCatalog(
  userId: string,
  projectId: string,
  typeKey: string
): ProjectWorkItemTypeDef | null {
  const entry = readWitCatalog(userId).projects[projectId];
  if (!entry) {
    return null;
  }
  return entry.types.find((def) => def.key === typeKey) ?? null;
}

export function collectTypeKeysFromWitCatalog(userId: string): string[] {
  return collectTypeOptionsFromWitCatalog(userId).map((option) => option.key);
}

/** Unique catalog options (key + display name), optionally scoped to one project. */
export function collectTypeOptionsFromWitCatalog(
  userId: string,
  projectId?: string | null
): Array<{ key: string; name: string }> {
  const store = readWitCatalog(userId);
  const byKey = new Map<string, string>();
  const entries =
    projectId && store.projects[projectId]
      ? [store.projects[projectId]]
      : Object.values(store.projects);
  for (const entry of entries) {
    if (!entry) {
      continue;
    }
    for (const def of entry.types) {
      if (!byKey.has(def.key)) {
        byKey.set(def.key, def.name.trim() || def.key);
      }
    }
  }
  return [...byKey.entries()]
    .map(([key, name]) => ({ key, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
