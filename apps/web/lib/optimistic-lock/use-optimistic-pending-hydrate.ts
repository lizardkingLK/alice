'use client';

import { useEffect, useRef } from 'react';
import type { OptimisticLockEntityType } from '@repo/types';
import {
  clearOptimisticPending,
  readOptimisticPending,
} from '@/lib/optimistic-lock/pending-storage';

type UseOptimisticPendingHydrateOptions = {
  readonly entityType: OptimisticLockEntityType;
  readonly entityId: string | null | undefined;
  readonly userId: string | null | undefined;
  /** Current server `updated_at` (or camelCase equivalent). */
  readonly serverUpdatedAt: string | null | undefined;
  readonly serverEntity?: Record<string, unknown>;
  readonly enabled?: boolean;
};

/**
 * On mount / entity change: if a pending localStorage snapshot exists and its
 * base timestamp is stale vs the fresh server row, treat a refresh/revisit as
 * **Take theirs** — clear pending so the loaded server row wins.
 */
export function useOptimisticPendingHydrate({
  entityType,
  entityId,
  userId,
  serverUpdatedAt,
  enabled = true,
}: UseOptimisticPendingHydrateOptions) {
  const clearedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || !entityId || !userId || !serverUpdatedAt) {
      return;
    }

    const pending = readOptimisticPending(entityType, entityId, userId);
    if (!pending || Object.keys(pending.pendingFields).length === 0) {
      return;
    }

    if (pending.baseUpdatedAt === serverUpdatedAt) {
      return;
    }

    const sessionKey = `${entityType}:${entityId}:${pending.savedAt}`;
    if (clearedKeyRef.current === sessionKey) {
      return;
    }
    clearedKeyRef.current = sessionKey;

    clearOptimisticPending(entityType, entityId, userId);
  }, [enabled, entityId, entityType, serverUpdatedAt, userId]);
}
