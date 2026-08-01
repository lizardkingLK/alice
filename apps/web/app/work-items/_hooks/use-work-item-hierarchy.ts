'use client';

import { useCallback, useEffect, useState } from 'react';
import { loadWorkItemChildrenAction } from '@/app/work-items/_components/actions';
import { workItemCanExpand } from '@/app/work-items/_helpers/work-item-hierarchy-rows';
import type { DbWorkItem } from '@/app/work-items/_services/workItem.service.server';

type UseWorkItemHierarchyOptions = {
  readonly enabled: boolean;
  readonly roots: readonly DbWorkItem[];
  // eslint-disable-next-line no-unused-vars -- error callback signature
  readonly onError?: (message: string) => void;
};

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
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
  const [isExpandingAll, setIsExpandingAll] = useState(false);

  useEffect(() => {
    setExpandedIds(new Set());
    setChildrenByParentId(new Map());
    setLoadingIds(new Set());
  }, [roots, enabled]);

  const ensureChildrenLoaded = useCallback(
    async (parentId: string): Promise<DbWorkItem[]> => {
      const cached = childrenByParentId.get(parentId);
      if (cached) {
        return cached;
      }

      setLoadingIds((prev) => new Set(prev).add(parentId));
      try {
        const children = await loadWorkItemChildrenAction(parentId);
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

  const collapseAll = useCallback(() => {
    setExpandedIds(new Set());
  }, []);

  const expandAll = useCallback(async () => {
    setIsExpandingAll(true);
    try {
      const nextExpanded = new Set(expandedIds);
      const nextChildren = new Map(childrenByParentId);
      const visited = new Set<string>();
      const queue = roots
        .filter((item) => workItemCanExpand(item.type))
        .map((item) => item.id);

      while (queue.length > 0) {
        const parentId = queue.shift();
        if (!parentId || visited.has(parentId)) {
          continue;
        }
        visited.add(parentId);
        nextExpanded.add(parentId);

        let children = nextChildren.get(parentId);
        if (!children) {
          children = await loadWorkItemChildrenAction(parentId);
          nextChildren.set(parentId, children);
        }

        for (const child of children) {
          if (workItemCanExpand(child.type) && !visited.has(child.id)) {
            queue.push(child.id);
          }
        }
      }

      setChildrenByParentId(nextChildren);
      setExpandedIds(nextExpanded);
    } catch (expandError) {
      onError?.(errorMessage(expandError, 'Failed to expand work items.'));
    } finally {
      setIsExpandingAll(false);
    }
  }, [childrenByParentId, expandedIds, onError, roots]);

  return {
    expandedIds,
    childrenByParentId,
    loadingIds,
    isExpandingAll,
    toggleExpand,
    expandAll,
    collapseAll,
  };
}
