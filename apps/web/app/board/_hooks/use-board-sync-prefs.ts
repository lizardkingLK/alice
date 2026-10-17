'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  DEFAULT_BOARD_SYNC_PREFS,
  readBoardSyncPrefs,
  writeBoardSyncPrefs,
  type BoardSyncPrefs,
} from '@/app/board/_helpers/board-sync-storage';

export function useBoardSyncPrefs(userId: string | null | undefined): {
  readonly prefs: BoardSyncPrefs;
  // eslint-disable-next-line no-unused-vars -- setter
  readonly setPrefs: (next: BoardSyncPrefs) => void;
} {
  const [prefs, setPrefsState] = useState<BoardSyncPrefs>(
    DEFAULT_BOARD_SYNC_PREFS
  );

  useEffect(() => {
    setPrefsState(readBoardSyncPrefs(userId));
  }, [userId]);

  const setPrefs = useCallback(
    (next: BoardSyncPrefs) => {
      setPrefsState(next);
      writeBoardSyncPrefs(userId, next);
    },
    [userId]
  );

  return { prefs, setPrefs };
}
