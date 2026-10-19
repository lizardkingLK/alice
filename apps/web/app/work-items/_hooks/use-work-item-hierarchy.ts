'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { loadWorkItemChildrenAction } from '@/app/work-items/_components/work-item-registry/actions';
import { childrenByParentIdToMap } from '@/app/work-items/_helpers/work-item-hierarchy-children';
import { replaceWorkItemInList } from '@/app/work-items/_helpers/work-item-merge-server-row';
import type { DbWorkItem } from '@/app/work-items/_services/work-items.reads.server';

type UseWorkItemHierarchyOptions = {
  readonly enabled: boolean;
  readonly roots: readonly DbWorkItem[];
  /** SSR packed children for the current root page. */
  readonly initialChildrenByParentId?: Record<string, readonly DbWorkItem[]>;
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

function initialExpandedRootIds(
  roots: readonly DbWorkItem[],
  children: ReadonlyMap<string, readonly DbWorkItem[]>
): Set<string> {
  // Focus drilldown is a single root with a seeded subtree — open it locally.
  if (roots.length !== 1) {
    return new Set();
  }
  const rootId = roots[0]?.id;
  if (!rootId) {
    return new Set();
  }
  const kids = children.get(rootId);
  if (!kids?.length) {
    return new Set();
  }
  return new Set([rootId]);
}

export function useWorkItemHierarchy({
  enabled,
  roots,
  initialChildrenByParentId,
  onError,
}: UseWorkItemHierarchyOptions) {
  const [childrenByParentId, setChildrenByParentId] = useState<
    Map<string, DbWorkItem[]>
  >(() => childrenByParentIdToMap(initialChildrenByParentId));
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() =>
    initialExpandedRootIds(
      roots,
      childrenByParentIdToMap(initialChildrenByParentId)
    )
  );
  const [loadingIds, setLoadingIds] = useState<Set<string>>(() => new Set());

  /** Reset expand cache when the set of root ids changes (filters/nav), not on row edits. */
  const rootIdsKey = useMemo(
    () => roots.map((item) => item.id).join('\0'),
    [roots]
  );

  useEffect(() => {
    const seeded = childrenByParentIdToMap(initialChildrenByParentId);
    setChildrenByParentId(seeded);
    setExpandedIds(initialExpandedRootIds(roots, seeded));
    setLoadingIds(new Set());
  }, [rootIdsKey, enabled, initialChildrenByParentId, roots]);

  const ensureChildrenLoaded = useCallback(
    async (parentId: string): Promise<DbWorkItem[]> => {
      // Empty arrays are intentional seeds (search panel / page budget).
      if (childrenByParentId.has(parentId)) {
        return childrenByParentId.get(parentId) ?? [];
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
