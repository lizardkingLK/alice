import {
  flattenWorkItemHierarchyRows,
  type WorkItemHierarchyDisplayRow,
} from '@/app/work-items/_helpers/work-item-hierarchy-rows';
import type { DbWorkItem } from '@/app/work-items/_services/workItem.service.server';
import type { WorkItemListView } from '@/lib/search-params';

const WORK_ITEM_FILTER_PARAMS = [
  'search',
  'project',
  'sprint',
  'type',
  'assignee',
] as const;

export function resolveWorkItemsListDescription(options: {
  readonly isAssigneeLocked: boolean;
  readonly isProjectLocked: boolean;
  readonly isHierarchy: boolean;
}): string {
  if (options.isAssigneeLocked) {
    return 'View and manage work items assigned to you.';
  }
  if (options.isProjectLocked) {
    return 'View, filter, and manage work items for this project.';
  }
  if (options.isHierarchy) {
    return 'Browse root work items and expand to view nested subtasks.';
  }
  return 'View, filter, and manage work items across your workspace.';
}

export function buildWorkItemDisplayRows(options: {
  readonly isHierarchy: boolean;
  readonly roots: readonly DbWorkItem[];
  readonly childrenByParentId: ReadonlyMap<string, readonly DbWorkItem[]>;
  readonly expandedIds: ReadonlySet<string>;
  readonly loadingIds: ReadonlySet<string>;
}): WorkItemHierarchyDisplayRow[] {
  if (!options.isHierarchy) {
    return options.roots.map((workItem) => ({
      workItem,
      depth: 0,
      canExpand: false,
      isExpanded: false,
      isLoading: false,
    }));
  }

  return flattenWorkItemHierarchyRows(
    options.roots,
    options.childrenByParentId,
    options.expandedIds,
    options.loadingIds
  );
}

export function hasActiveWorkItemFilters(options: {
  readonly searchParams: URLSearchParams;
  readonly isProjectLocked: boolean;
  readonly isAssigneeLocked: boolean;
  readonly showWorkspaceDefaults: boolean;
  readonly urlFiltersActive: boolean;
}): boolean {
  return WORK_ITEM_FILTER_PARAMS.some((key) => {
    if (key === 'project' && options.isProjectLocked) {
      return false;
    }
    if (key === 'sprint' && options.isProjectLocked) {
      return false;
    }
    if (key === 'assignee' && options.isAssigneeLocked) {
      return false;
    }
    if (
      options.showWorkspaceDefaults &&
      (key === 'project' || key === 'sprint') &&
      !options.urlFiltersActive
    ) {
      return false;
    }
    return Boolean(options.searchParams.get(key)?.trim());
  });
}

export function applyWorkItemListViewParam(
  params: URLSearchParams,
  listView: WorkItemListView
): void {
  if (listView === 'hierarchy') {
    params.set('view', 'hierarchy');
    return;
  }
  params.delete('view');
}

export function buildClearedWorkItemFilterParams(options: {
  readonly searchParams: URLSearchParams;
  readonly listView: WorkItemListView;
  readonly lockedProjectId?: string;
  readonly lockedAssigneeId?: string;
}): URLSearchParams {
  const next = new URLSearchParams();
  const limitParam = options.searchParams.get('limit');
  const tabParam = options.searchParams.get('tab');
  if (limitParam) {
    next.set('limit', limitParam);
  }
  if (tabParam) {
    next.set('tab', tabParam);
  }
  applyWorkItemListViewParam(next, options.listView);
  if (options.lockedProjectId) {
    next.set('project', options.lockedProjectId);
  }
  if (options.lockedAssigneeId) {
    next.set('assignee', options.lockedAssigneeId);
  }
  return next;
}
