'use client';

import { useCallback, useSyncExternalStore } from 'react';
import {
  closeMusicDocumentPip,
  getMusicPipSession,
  isDocumentPipSupported,
  openMusicDocumentPip,
  subscribeMusicPip,
  type MusicPipSession,
} from '@/app/dashboard/_helpers/music-document-pip';

export type { MusicPipSession };

type MusicPipApi = {
  readonly session: MusicPipSession | null;
  readonly supported: boolean;
  readonly popOut: (
    // eslint-disable-next-line no-unused-vars -- session callback
    session: MusicPipSession
  ) => Promise<boolean>;
  readonly dock: () => void;
};

function getServerSnapshot(): MusicPipSession | null {
  return null;
}

/** Document PiP session for the Focus music pane (survives in-app navigation). */
export function useMusicPip(): MusicPipApi {
  const session = useSyncExternalStore(
    subscribeMusicPip,
    getMusicPipSession,
    getServerSnapshot
  );

  const popOut = useCallback(async (next: MusicPipSession) => {
    return openMusicDocumentPip(next);
  }, []);

  const dock = useCallback(() => {
    closeMusicDocumentPip();
  }, []);

  return {
    session,
    supported: isDocumentPipSupported(),
    popOut,
    dock,
  };
}

/** Always available; Document PiP state lives in a module singleton. */
export function useMusicPipOptional(): MusicPipApi {
  return useMusicPip();
}
