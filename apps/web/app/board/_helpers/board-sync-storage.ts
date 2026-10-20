import { getLocalStorageJson, setLocalStorageJson } from '@/lib/local-storage';

export const BOARD_SYNC_MODES = ['realtime', 'static'] as const;

export type BoardSyncMode = (typeof BOARD_SYNC_MODES)[number];

export type BoardSyncPrefs = {
  readonly syncMode: BoardSyncMode;
  /** Listen for placement/status realtime when syncMode is realtime. */
  readonly subscribeStatusEvents: boolean;
};

export const DEFAULT_BOARD_SYNC_PREFS: BoardSyncPrefs = {
  syncMode: 'realtime',
  subscribeStatusEvents: true,
};

const STORAGE_PREFIX = 'alice:board-sync:v1:';

function storageKey(userId: string) {
  return `${STORAGE_PREFIX}${userId}`;
}

function isSyncMode(value: unknown): value is BoardSyncMode {
  return (
    typeof value === 'string' &&
    (BOARD_SYNC_MODES as readonly string[]).includes(value)
  );
}

export function readBoardSyncPrefs(
  userId: string | null | undefined
): BoardSyncPrefs {
  if (!userId) {
    return DEFAULT_BOARD_SYNC_PREFS;
  }

  const parsed = getLocalStorageJson<Partial<BoardSyncPrefs>>(
    storageKey(userId)
  );
  if (!parsed || typeof parsed !== 'object') {
    return DEFAULT_BOARD_SYNC_PREFS;
  }

  const syncMode = isSyncMode(parsed.syncMode)
    ? parsed.syncMode
    : DEFAULT_BOARD_SYNC_PREFS.syncMode;
  const subscribeStatusEvents =
    typeof parsed.subscribeStatusEvents === 'boolean'
      ? parsed.subscribeStatusEvents
      : syncMode === 'realtime';

  return { syncMode, subscribeStatusEvents };
}

export function writeBoardSyncPrefs(
  userId: string | null | undefined,
  prefs: BoardSyncPrefs
): void {
  if (!userId) {
    return;
  }
  setLocalStorageJson(storageKey(userId), prefs);
}

/** Realtime channel should be active for this preference set. */
export function shouldSubscribeBoardWorkItems(prefs: BoardSyncPrefs): boolean {
  return prefs.syncMode === 'realtime' && prefs.subscribeStatusEvents;
}

/** Next subscribe flag when the user picks Realtime or Static in the menu. */
export function resolveSubscribeStatusEvents(
  nextMode: BoardSyncMode,
  current: BoardSyncPrefs
): boolean {
  if (nextMode !== 'realtime') {
    return false;
  }
  if (current.syncMode === 'realtime') {
    return current.subscribeStatusEvents;
  }
  return true;
}
