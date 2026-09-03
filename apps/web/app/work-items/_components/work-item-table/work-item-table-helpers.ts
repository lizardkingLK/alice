import { serializeWorkItemLabelsFilter } from '@repo/types';
import {
  flattenWorkItemHierarchyRows,
  type WorkItemHierarchyDisplayRow,
} from '@/app/work-items/_helpers/work-item-hierarchy-rows';
import type { DbWorkItem } from '@/app/work-items/_services/work-items.reads.server';
import { applyQueryFilterParam } from '@/hooks/use-query-filter';
import type { WorkItemListView } from '@/lib/search-params';

const WORK_ITEM_FILTER_PARAMS = [
  'search',
  'project',
  'sprint',
  'type',
  'assignee',
  'labels',
] as const;

/** Staged work-item list filters edited in the filter dialog before Okay. */
export type WorkItemsFilterDraft = {
  readonly project: string;
  readonly sprint: string;
  readonly type: string;
  readonly assignee: string;
  readonly labels: readonly string[];
  readonly priority: string;
};

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

/**
 * Write Active/Archived lifecycle filter without clobbering page-level `tab`
 * (project details uses `tab=work-items`, etc.).
 */
export function applyWorkItemRecordStatusParam(
  params: URLSearchParams,
  recordStatus: 'active' | 'archived'
): void {
  if (recordStatus === 'archived') {
    params.set('recordStatus', 'archived');
  } else {
    params.delete('recordStatus');
  }
  const legacyTab = params.get('tab');
  if (legacyTab === 'active' || legacyTab === 'archived') {
    params.delete('tab');
  }
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
  const recordStatusParam = options.searchParams.get('recordStatus');
  if (limitParam) {
    next.set('limit', limitParam);
  }
  if (tabParam) {
    next.set('tab', tabParam);
  }
  if (recordStatusParam === 'archived' || recordStatusParam === 'active') {
    next.set('recordStatus', recordStatusParam);
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

/**
 * Writes project/sprint from a filter draft into search params.
 * Used by the work-items list and board so URL updates stay consistent.
 */
export function applyWorkItemsProjectSprintDraftToSearchParams(
  params: URLSearchParams,
  draft: Pick<WorkItemsFilterDraft, 'project' | 'sprint'>,
  options: {
    readonly allValue: string;
    /** When false, only sprint is written (project locked / omitted). */
    readonly applyProject: boolean;
  }
): void {
  const { allValue } = options;

  if (!options.applyProject) {
    applyQueryFilterParam(params, 'sprint', draft.sprint, allValue);
    return;
  }

  if (!draft.project || draft.project === allValue) {
    // Explicit sentinel so SSR can tell "All projects" from unset bootstrap.
    params.set('project', allValue);
    params.delete('sprint');
    return;
  }

  params.set('project', draft.project);
  applyQueryFilterParam(params, 'sprint', draft.sprint, allValue);
}

/**
 * Writes staged filter-dialog values into search params in one shot so Okay
 * triggers a single navigation / refetch.
 */
export function applyWorkItemsFilterDraftToSearchParams(
  params: URLSearchParams,
  draft: WorkItemsFilterDraft,
  options: {
    readonly allValue: string;
    readonly isProjectLocked: boolean;
    readonly isAssigneeLocked: boolean;
    readonly listView: WorkItemListView;
  }
): void {
  const { allValue } = options;

  if (!options.isProjectLocked) {
    applyWorkItemsProjectSprintDraftToSearchParams(params, draft, {
      allValue,
      applyProject: true,
    });
  }

  applyQueryFilterParam(params, 'type', draft.type, allValue);

  if (!options.isAssigneeLocked) {
    applyQueryFilterParam(params, 'assignee', draft.assignee, allValue);
  }

  const labelsEncoded = serializeWorkItemLabelsFilter([...draft.labels]);
  applyQueryFilterParam(params, 'labels', labelsEncoded || allValue, allValue);

  applyWorkItemListViewParam(params, options.listView);
  params.set('page', '1');
}
