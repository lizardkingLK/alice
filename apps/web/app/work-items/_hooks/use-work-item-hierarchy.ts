'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { loadWorkItemChildrenAction } from '@/app/work-items/_components/work-item-registry/actions';
import { replaceWorkItemInList } from '@/app/work-items/_helpers/work-item-merge-server-row';
import type { DbWorkItem } from '@/app/work-items/_services/work-items.reads.server';

type UseWorkItemHierarchyOptions = {
  readonly enabled: boolean;
  readonly roots: readonly DbWorkItem[];
  // eslint-disable-next-line no-unused-vars -- error callback signature
  readonly onError?: (message: string) => void;
};

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

async function loadChildrenForParent(
  parentId: string,
  // eslint-disable-next-line no-unused-vars -- error callback signature
  onError?: (message: string) => void
): Promise<DbWorkItem[] | null> {
  const result = await loadWorkItemChildrenAction(parentId);
  if (!result.ok) {
    onError?.(result.error);
    return null;
  }
  return result.children;
}

export function useWorkItemHierarchy({
  enabled,
  roots,
  onError,
}: UseWorkItemHierarchyOptions) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const [childrenByParentId, setChildrenByParentId] = useState<
    Map<string, DbWorkItem[]>
  >(() => new Map());
  const [loadingIds, setLoadingIds] = useState<Set<string>>(() => new Set());

  /** Reset expand cache when the set of root ids changes (filters/nav), not on row edits. */
  const rootIdsKey = useMemo(
    () => roots.map((item) => item.id).join('\0'),
    [roots]
  );

  useEffect(() => {
    setExpandedIds(new Set());
    setChildrenByParentId(new Map());
    setLoadingIds(new Set());
  }, [rootIdsKey, enabled]);

  const ensureChildrenLoaded = useCallback(
    async (parentId: string): Promise<DbWorkItem[]> => {
      const cached = childrenByParentId.get(parentId);
      if (cached) {
        return cached;
      }

      setLoadingIds((prev) => new Set(prev).add(parentId));
      try {
        const children = await loadChildrenForParent(parentId, onError);
        if (children === null) {
          setExpandedIds((prev) => {
            const next = new Set(prev);
            next.delete(parentId);
            return next;
          });
          return [];
        }
        setChildrenByParentId((prev) => {
          const next = new Map(prev);
          next.set(parentId, children);
          return next;
        });
        return children;
      } catch (loadError) {
        onError?.(errorMessage(loadError, 'Failed to load subtasks.'));
        setExpandedIds((prev) => {
          const next = new Set(prev);
          next.delete(parentId);
          return next;
        });
        return [];
      } finally {
        setLoadingIds((prev) => {
          const next = new Set(prev);
          next.delete(parentId);
          return next;
        });
      }
    },
    [childrenByParentId, onError]
  );

  const toggleExpand = useCallback(
    async (workItemId: string) => {
      if (expandedIds.has(workItemId)) {
        setExpandedIds((prev) => {
          const next = new Set(prev);
          next.delete(workItemId);
          return next;
        });
        return;
      }

      setExpandedIds((prev) => new Set(prev).add(workItemId));
      await ensureChildrenLoaded(workItemId);
    },
    [ensureChildrenLoaded, expandedIds]
  );

  const patchWorkItem = useCallback((updated: DbWorkItem) => {
    setChildrenByParentId((previous) => {
      let changed = false;
      const next = new Map(previous);
      for (const [parentId, children] of previous) {
        const index = children.findIndex((child) => child.id === updated.id);
        if (index < 0) {
          continue;
        }
        next.set(parentId, replaceWorkItemInList(children, updated));
        changed = true;
      }
      return changed ? next : previous;
    });
  }, []);

  return {
    expandedIds,
    childrenByParentId,
    loadingIds,
    toggleExpand,
    patchWorkItem,
  };
}
