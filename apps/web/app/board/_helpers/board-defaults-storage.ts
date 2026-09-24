import {
  getLocalStorageJson,
  removeLocalStorageItem,
  setLocalStorageJson,
} from '@/lib/local-storage';

/** Sentinel used in preference objects and URL query values for All projects. */
export const ALL_PROJECTS_ID = 'all';

export type BoardDefaultsPreference = {
  readonly projectId: string;
  readonly sprintId: string | null;
};

const STORAGE_PREFIX = 'alice:board-defaults:';

function storageKey(userId: string) {
  return `${STORAGE_PREFIX}${userId}`;
}

function isPreference(value: unknown): value is BoardDefaultsPreference {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const record = value as Record<string, unknown>;
  if (typeof record.projectId !== 'string' || record.projectId.length === 0) {
    return false;
  }
  if (record.projectId === ALL_PROJECTS_ID) {
    return record.sprintId === null;
  }
  if (record.sprintId !== null && typeof record.sprintId !== 'string') {
    return false;
  }
  return true;
}

/**
 * Legacy shape `{ preference, prompted }` from the old defaults dialog.
 * Still accepted on read so existing browsers migrate cleanly.
 */
function preferenceFromLegacyRecord(
  value: unknown
): BoardDefaultsPreference | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (!('preference' in record) || !('prompted' in record)) {
    return null;
  }
  if (record.preference === null) {
    return null;
  }
  return isPreference(record.preference) ? record.preference : null;
}

/**
 * Normalize All/All to null (no storage). Concrete project/sprint otherwise.
 */
export function normalizeBoardDefaultsPreference(
  preference: BoardDefaultsPreference | null | undefined
): BoardDefaultsPreference | null {
  if (!preference || preference.projectId === ALL_PROJECTS_ID) {
    return null;
  }
  return {
    projectId: preference.projectId,
    sprintId: preference.sprintId,
  };
}

/**
 * Read board defaults for a user. Missing key / All/All / corrupt → null.
 */
export function readBoardDefaults(
  userId: string
): BoardDefaultsPreference | null {
  if (!userId) {
    return null;
  }

  const parsed = getLocalStorageJson<unknown>(storageKey(userId));
  if (isPreference(parsed)) {
    return normalizeBoardDefaultsPreference(parsed);
  }
  return normalizeBoardDefaultsPreference(preferenceFromLegacyRecord(parsed));
}

/**
 * Persist a concrete project/sprint default. Pass null to clear (All/All).
 */
export function writeBoardDefaults(
  userId: string,
  preference: BoardDefaultsPreference | null
): void {
  if (!userId) {
    return;
  }

  const normalized = normalizeBoardDefaultsPreference(preference);
  if (!normalized) {
    clearBoardDefaults(userId);
    return;
  }

  setLocalStorageJson(storageKey(userId), normalized);
  emitBoardDefaultsChanged(userId);
}

export function clearBoardDefaults(userId: string): void {
  if (!userId) {
    return;
  }

  removeLocalStorageItem(storageKey(userId));
  emitBoardDefaultsChanged(userId);
}

/** Same-tab signal so nav (sidebar) can refresh after defaults are saved. */
export const BOARD_DEFAULTS_CHANGED_EVENT = 'alice:board-defaults-changed';

function emitBoardDefaultsChanged(userId: string): void {
  if (globalThis.window === undefined) {
    return;
  }
  globalThis.window.dispatchEvent(
    new CustomEvent(BOARD_DEFAULTS_CHANGED_EVENT, { detail: { userId } })
  );
}

/**
 * Prefer stored preference when project (and sprint, if set) still exist.
 * Invalid preferences return null so callers treat as All/All.
 */
export function validateBoardDefaultsPreference(
  preference: BoardDefaultsPreference,
  projectIds: ReadonlySet<string>,
  sprintById: ReadonlyMap<string, { readonly projectId: string | null }>
): BoardDefaultsPreference | null {
  const normalized = normalizeBoardDefaultsPreference(preference);
  if (!normalized) {
    return null;
  }

  if (!projectIds.has(normalized.projectId)) {
    return null;
  }

  if (normalized.sprintId === null) {
    return normalized;
  }

  const sprint = sprintById.get(normalized.sprintId);
  if (sprint?.projectId !== normalized.projectId) {
    return null;
  }

  return normalized;
}

/**
 * Read storage and return the validated preference (or null if missing/invalid).
 */
export function readValidatedBoardDefaults(
  userId: string,
  projectIds: ReadonlySet<string>,
  sprintById: ReadonlyMap<string, { readonly projectId: string | null }>
): {
  readonly preference: BoardDefaultsPreference | null;
} {
  const stored = readBoardDefaults(userId);
  const preference = stored
    ? validateBoardDefaultsPreference(stored, projectIds, sprintById)
    : null;

  if (stored && !preference) {
    clearBoardDefaults(userId);
  }

  return { preference };
}
