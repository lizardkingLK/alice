'use client';

import { useEffect } from 'react';

type PendingMutationUnloadSource = {
  hasAnyPending: () => boolean;
  flushPendingKeepalive: () => void;
};

/**
 * Native leave prompt + pagehide/unmount keepalive flush while optimistic
 * mutations are still pending. Custom app dialogs cannot block hard refresh/close.
 */
export function usePendingMutationUnload(
  source: PendingMutationUnloadSource
): void {
  useEffect(() => {
    const flushKeepalive = () => {
      if (!source.hasAnyPending()) {
        return;
      }
      source.flushPendingKeepalive();
    };
    const onPageHide = () => {
      flushKeepalive();
    };
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!source.hasAnyPending()) {
        return;
      }
      flushKeepalive();
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('beforeunload', onBeforeUnload);
      flushKeepalive();
    };
  }, [source]);
}
