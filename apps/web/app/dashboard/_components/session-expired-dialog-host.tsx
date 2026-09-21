'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { AlertTriangle } from '@repo/ui/lib/icons';
import { Button } from '@repo/ui/components/ui/button';
import {
  SESSION_EXPIRED_EVENT,
  SESSION_EXPIRED_MESSAGE,
  type SessionExpiredEventDetail,
} from '@/lib/errors/session-expired';

/**
 * Listens for `alice:session-expired` from client `apiFetch` and shows a
 * sign-in dialog instead of letting NEXT_REDIRECT / generic fetch errors bubble.
 */
export function SessionExpiredDialogHost() {
  const [loginPath, setLoginPath] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const onExpired = (event: Event) => {
      const custom = event as CustomEvent<SessionExpiredEventDetail>;
      const path = custom.detail?.loginPath?.trim() || '/login';
      setLoginPath(path);
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, []);

  if (!mounted || !loginPath) {
    return null;
  }

  return createPortal(
    <div
      role="presentation"
      className="animate-in fade-in fixed inset-0 z-[300] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm duration-200"
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="session-expired-title"
        className="bg-card border-border animate-in fade-in zoom-in-95 relative w-full max-w-md overflow-hidden rounded-xl border shadow-2xl duration-200"
      >
        <div className="p-6">
          <div className="mb-3 flex items-center gap-3 text-amber-600">
            <div className="rounded-full border border-amber-500/20 bg-amber-500/10 p-2">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h3
              id="session-expired-title"
              className="text-foreground text-lg font-bold"
            >
              Session expired
            </h3>
          </div>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {SESSION_EXPIRED_MESSAGE} Your place on this page will be restored
            after you sign in.
          </p>
        </div>
        <div className="bg-muted/40 border-border flex justify-end gap-3 border-t px-6 py-4">
          <Button asChild className="h-9 px-4 text-xs font-semibold">
            <Link href={loginPath}>Sign in</Link>
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
