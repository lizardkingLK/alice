'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from '@repo/ui/lib/icons';
import { createClient } from '@/lib/supabase/client';

/**
 * Legacy fallback for old email links.
 *
 * Older invite/recovery emails used Supabase's `/auth/v1/verify` endpoint,
 * which returns the session in the URL **hash fragment** (implicit flow).
 * The server callback can't read the fragment, so those links land here on
 * `/forgot-password?error=expired#access_token=…`. Rather than show a bogus
 * "expired" error, this reads the hash client-side, establishes the session,
 * and forwards to `/reset-password`.
 *
 * New links use the `token_hash` + `verifyOtp` flow and never reach this.
 */

const RECOVERY_TYPES = new Set(['invite', 'recovery']);

function parseHashTokens(hash: string) {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  return {
    accessToken: params.get('access_token'),
    refreshToken: params.get('refresh_token'),
    type: params.get('type'),
  };
}

export function RecoveryHashGuard() {
  const router = useRouter();
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.location.hash) {
      return;
    }

    const { accessToken, refreshToken, type } = parseHashTokens(
      window.location.hash
    );

    if (!accessToken || !refreshToken) {
      return;
    }

    setRecovering(true);
    const supabase = createClient();

    supabase.auth
      .setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(({ error }) => {
        // Strip the tokens from the URL regardless of outcome.
        window.history.replaceState(null, '', window.location.pathname);

        if (error) {
          console.error(
            'error. failed to restore session from legacy link:',
            error.message
          );
          setRecovering(false);
          return;
        }

        const next =
          type && RECOVERY_TYPES.has(type) ? '/reset-password' : '/dashboard';
        router.replace(next);
      })
      .catch(() => {
        window.history.replaceState(null, '', window.location.pathname);
        setRecovering(false);
      });
  }, [router]);

  if (!recovering) {
    return null;
  }

  return (
    <div className="bg-background/80 fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 backdrop-blur-sm">
      <Loader2 className="text-primary h-6 w-6 animate-spin" />
      <p className="text-muted-foreground text-sm">Finishing sign in…</p>
    </div>
  );
}
