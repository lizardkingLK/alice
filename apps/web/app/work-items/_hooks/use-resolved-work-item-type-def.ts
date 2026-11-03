'use client';

import { useMemo } from 'react';
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

  return useMemo(() => {
    if (typeDef) {
      return typeDef;
    }
    if (!userId || !projectId || !type) {
      return null;
    }
    return resolveTypeFromWitCatalog(userId, projectId, type);
  }, [projectId, type, typeDef, userId]);
}
