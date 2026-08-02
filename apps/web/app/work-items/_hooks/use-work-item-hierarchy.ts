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

type ExpandAllState = {
  readonly nextExpanded: Set<string>;
  readonly nextChildren: Map<string, DbWorkItem[]>;
  readonly visited: Set<string>;
};

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function mergeChildrenMaps(
  base: Map<string, DbWorkItem[]>,
  incoming: Map<string, DbWorkItem[]>
): Map<string, DbWorkItem[]> {
  const next = new Map(base);
  for (const [parentId, children] of incoming) {
    next.set(parentId, children);
  }
  return next;
}

function mergeIdSets(base: Set<string>, incoming: Set<string>): Set<string> {
  const next = new Set(base);
  for (const id of incoming) {
    next.add(id);
  }
  return next;
}

function rootExpandableIds(roots: readonly DbWorkItem[]): string[] {
  return roots
    .filter((item) => workItemCanExpand(item.type))
    .map((item) => item.id);
}

function markLevelVisited(
  parentsThisLevel: readonly string[],
  state: ExpandAllState
): void {
  for (const parentId of parentsThisLevel) {
    state.visited.add(parentId);
    state.nextExpanded.add(parentId);
  }
}

async function loadMissingLevelChildren(
  parentsThisLevel: readonly string[],
  state: ExpandAllState,
  // eslint-disable-next-line no-unused-vars -- error callback signature
  onError?: (message: string) => void
): Promise<void> {
  const missingParents = parentsThisLevel.filter(
    (parentId) => !state.nextChildren.has(parentId)
  );
  if (missingParents.length === 0) {
    return;
  }

  const loaded = await Promise.all(
    missingParents.map(async (parentId) => {
      try {
        const children = await loadWorkItemChildrenAction(parentId);
        return [parentId, children] as const;
      } catch (loadError) {
        onError?.(errorMessage(loadError, 'Failed to load subtasks.'));
        return [parentId, [] as DbWorkItem[]] as const;
      }
    })
  );

  for (const [parentId, children] of loaded) {
    state.nextChildren.set(parentId, children);
  }
}

function collectNextExpandableLevel(
  parentsThisLevel: readonly string[],
  state: ExpandAllState
): string[] {
  const nextLevel: string[] = [];
  for (const parentId of parentsThisLevel) {
    const children = state.nextChildren.get(parentId) ?? [];
    for (const child of children) {
      if (workItemCanExpand(child.type) && !state.visited.has(child.id)) {
        nextLevel.push(child.id);
      }
    }
  }
  return nextLevel;
}

async function expandHierarchyBreadthFirst(options: {
  readonly roots: readonly DbWorkItem[];
  readonly expandedIds: ReadonlySet<string>;
  readonly childrenByParentId: ReadonlyMap<string, DbWorkItem[]>;
  readonly commitChildren: (
    // eslint-disable-next-line no-unused-vars -- Map merge updater
    updater: (prev: Map<string, DbWorkItem[]>) => Map<string, DbWorkItem[]>
  ) => void;
  readonly commitExpanded: (
    // eslint-disable-next-line no-unused-vars -- Set merge updater
    updater: (prev: Set<string>) => Set<string>
  ) => void;
  // eslint-disable-next-line no-unused-vars -- error callback signature
  readonly onError?: (message: string) => void;
}): Promise<void> {
  const state: ExpandAllState = {
    nextExpanded: new Set(options.expandedIds),
    nextChildren: new Map(options.childrenByParentId),
    visited: new Set(),
  };

  let level = rootExpandableIds(options.roots);

  while (level.length > 0) {
    const parentsThisLevel = level.filter(
      (parentId) => !state.visited.has(parentId)
    );

    markLevelVisited(parentsThisLevel, state);
    await loadMissingLevelChildren(parentsThisLevel, state, options.onError);

    // Merge so concurrent toggle loads / collapses are preserved.
    options.commitChildren((prev) =>
      mergeChildrenMaps(prev, state.nextChildren)
    );
    options.commitExpanded((prev) => mergeIdSets(prev, state.nextExpanded));

    level = collectNextExpandableLevel(parentsThisLevel, state);
  }
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
      await expandHierarchyBreadthFirst({
        roots,
        expandedIds,
        childrenByParentId,
        commitChildren: setChildrenByParentId,
        commitExpanded: setExpandedIds,
        onError,
      });
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
