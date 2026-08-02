'use client';

import { useEffect, useRef } from 'react';
import type { OptimisticLockEntityType } from '@repo/types';
import {
  OPTIMISTIC_PENDING_INTERVAL_MS,
  clearOptimisticPending,
  upsertOptimisticPendingFields,
} from '@/lib/optimistic-lock/pending-storage';

type UseOptimisticPendingOptions = {
  readonly entityType: OptimisticLockEntityType;
  readonly entityId: string | null | undefined;
  readonly userId: string | null | undefined;
  readonly baseUpdatedAt: string | null | undefined;
  /** Latest dirty field map; empty object means nothing to persist. */
  readonly pendingFields: Record<string, unknown>;
  readonly enabled?: boolean;
};

/**
 * Every 5s (same cadence as description autosave), persist only dirty fields
 * for conflict recovery after a rejected optimistic lock update.
 */
export function useOptimisticPending({
  entityType,
  entityId,
  userId,
  baseUpdatedAt,
  pendingFields,
  enabled = true,
}: UseOptimisticPendingOptions) {
  const pendingRef = useRef(pendingFields);
  pendingRef.current = pendingFields;

  useEffect(() => {
    if (!enabled || !entityId || !userId || !baseUpdatedAt) {
      return;
    }

    const tick = () => {
      const fields = pendingRef.current;
      if (Object.keys(fields).length === 0) {
        return;
      }
      upsertOptimisticPendingFields({
        entityType,
        entityId,
        userId,
        baseUpdatedAt,
        pendingFields: fields,
      });
    };

    tick();
    const intervalId = window.setInterval(tick, OPTIMISTIC_PENDING_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [baseUpdatedAt, enabled, entityId, entityType, userId]);

  const clearPending = () => {
    if (!entityId || !userId) {
      return;
    }
    clearOptimisticPending(entityType, entityId, userId);
  };

  return { clearPending };
}
