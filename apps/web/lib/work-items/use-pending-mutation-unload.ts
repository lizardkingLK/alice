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
      // Native leave prompt only — browsers ignore custom message strings.
      event.preventDefault();
      // Chromium still requires returnValue for the dialog (deprecated but needed).
      event.returnValue = ''; // NOSONAR
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
