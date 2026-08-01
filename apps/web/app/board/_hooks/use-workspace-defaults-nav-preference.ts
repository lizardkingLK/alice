'use client';

import { useEffect, useState } from 'react';
import {
  BOARD_DEFAULTS_CHANGED_EVENT,
  readBoardDefaults,
  type BoardDefaultsPreference,
} from '@/app/board/_helpers/board-defaults-storage';
import { createClient } from '@/lib/supabase/client';

/**
 * Live workspace defaults preference for nav links.
 * Resolves the user from `userId` or Supabase auth, then tracks localStorage.
 */
export function useWorkspaceDefaultsNavPreference(
  userIdProp?: string | null
): BoardDefaultsPreference | null {
  const [userId, setUserId] = useState<string | null>(userIdProp ?? null);
  const [preference, setPreference] = useState<BoardDefaultsPreference | null>(
    null
  );

  useEffect(() => {
    if (userIdProp) {
      setUserId(userIdProp);
      return;
    }

    let cancelled = false;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!cancelled) {
        setUserId(user?.id ?? null);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [userIdProp]);

  useEffect(() => {
    if (!userId) {
      setPreference(null);
      return;
    }

    const refresh = () => {
      setPreference(readBoardDefaults(userId)?.preference ?? null);
    };

    refresh();
    window.addEventListener('focus', refresh);
    window.addEventListener('storage', refresh);
    window.addEventListener(BOARD_DEFAULTS_CHANGED_EVENT, refresh);

    return () => {
      window.removeEventListener('focus', refresh);
      window.removeEventListener('storage', refresh);
      window.removeEventListener(BOARD_DEFAULTS_CHANGED_EVENT, refresh);
    };
  }, [userId]);

  return preference;
}
