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
  const [prefs, setPrefs] = useState<BoardSyncPrefs>(DEFAULT_BOARD_SYNC_PREFS);

  useEffect(() => {
    setPrefs(readBoardSyncPrefs(userId));
  }, [userId]);

  const commitPrefs = useCallback(
    (next: BoardSyncPrefs) => {
      setPrefs(next);
      writeBoardSyncPrefs(userId, next);
    },
    [userId]
  );

  return { prefs, setPrefs: commitPrefs };
}
