'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ProjectWorkItemTypeDef, WorkItemType } from '@repo/types';
import { resolveTypeFromWitCatalog } from '@/app/work-items/_helpers/wit-catalog-storage';
import { useSoftInvalidateUserId } from '@/components/soft-invalidate/soft-invalidate-provider';

type UseResolvedWorkItemTypeDefParams = {
  readonly projectId?: string | null;
  readonly type?: WorkItemType | null;
  /** Prefer live catalog def when the parent already has workflow_config. */
  readonly typeDef?: Pick<
    ProjectWorkItemTypeDef,
    'key' | 'name' | 'icon' | 'color'
  > | null;
};

/**
 * Resolves a work-item type catalog def for badges/labels.
 * Prefer explicit `typeDef`; otherwise look up the client catalog cache.
 *
 * localStorage is client-only — defer catalog reads until after mount so the
 * first client render matches SSR (avoids WorkItemTypeBadge hydration mismatches).
 */
export function useResolvedWorkItemTypeDef({
  projectId,
  type,
  typeDef = null,
}: UseResolvedWorkItemTypeDefParams): Pick<
  ProjectWorkItemTypeDef,
  'key' | 'name' | 'icon' | 'color'
> | null {
  const userId = useSoftInvalidateUserId();
  const [catalogReady, setCatalogReady] = useState(false);

  useEffect(() => {
    setCatalogReady(true);
  }, []);

  return useMemo(() => {
    if (typeDef) {
      return typeDef;
    }
    if (!catalogReady || !userId || !projectId || !type) {
      return null;
    }
    return resolveTypeFromWitCatalog(userId, projectId, type);
  }, [catalogReady, projectId, type, typeDef, userId]);
}
