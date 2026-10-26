'use client';

import { useEffect } from 'react';
import { useSoftInvalidateOptional } from '@/components/soft-invalidate/soft-invalidate-provider';

/**
 * While `hold` is true, workflow soft-invalidation shows a banner instead of
 * auto-refreshing (open create/edit forms and dialogs).
 */
export function useSoftInvalidateHoldAutoRefresh(hold: boolean): void {
  const softInvalidate = useSoftInvalidateOptional();

  useEffect(() => {
    if (!softInvalidate) {
      return;
    }
    softInvalidate.setAutoRefreshHold(hold);
    return () => {
      softInvalidate.setAutoRefreshHold(false);
    };
  }, [softInvalidate, hold]);
}
