import {
  getLocalStorageJson,
  removeLocalStorageItem,
  setLocalStorageJson,
} from '@/lib/local-storage';

/** Sentinel stored in preferences when the user wants every project visible. */
export const ALL_PROJECTS_ID = 'all';

export type BoardDefaultsPreference = {
  readonly projectId: string;
  readonly sprintId: string | null;
};

export type BoardDefaultsRecord = {
  readonly preference: BoardDefaultsPreference | null;
  readonly prompted: boolean;
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

function isRecord(value: unknown): value is BoardDefaultsRecord {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const record = value as Record<string, unknown>;
  if (typeof record.prompted !== 'boolean') {
    return false;
  }
  if (record.preference !== null && !isPreference(record.preference)) {
    return false;
  }
  return true;
}

/**
 * Read board defaults for a user. Returns null when missing or corrupt.
 */
export function readBoardDefaults(userId: string): BoardDefaultsRecord | null {
  if (!userId) {
    return null;
  }

  const parsed = getLocalStorageJson<unknown>(storageKey(userId));
  return isRecord(parsed) ? parsed : null;
}

export function writeBoardDefaults(
  userId: string,
  record: BoardDefaultsRecord
): void {
  if (!userId) {
    return;
  }

  setLocalStorageJson(storageKey(userId), record);
}

export function clearBoardDefaults(userId: string): void {
  if (!userId) {
    return;
  }

  removeLocalStorageItem(storageKey(userId));
}

/**
 * Prefer stored preference when project (and sprint, if set) still exist.
 * Invalid preferences return null so callers can fall back to suggested defaults.
 */
export function validateBoardDefaultsPreference(
  preference: BoardDefaultsPreference,
  projectIds: ReadonlySet<string>,
  sprintById: ReadonlyMap<string, { readonly projectId: string | null }>
): BoardDefaultsPreference | null {
  if (preference.projectId === ALL_PROJECTS_ID) {
    return { projectId: ALL_PROJECTS_ID, sprintId: null };
  }

  if (!projectIds.has(preference.projectId)) {
    return null;
  }

  if (preference.sprintId === null) {
    return preference;
  }

  const sprint = sprintById.get(preference.sprintId);
  if (sprint?.projectId !== preference.projectId) {
    return null;
  }

  return preference;
}

/**
 * Read storage and return the validated preference (or null if missing/invalid).
 */
export function readValidatedBoardDefaults(
  userId: string,
  projectIds: ReadonlySet<string>,
  sprintById: ReadonlyMap<string, { readonly projectId: string | null }>
): {
  readonly record: BoardDefaultsRecord | null;
  readonly preference: BoardDefaultsPreference | null;
} {
  const record = readBoardDefaults(userId);
  const preference = record?.preference
    ? validateBoardDefaultsPreference(record.preference, projectIds, sprintById)
    : null;

  return { record, preference };
}
