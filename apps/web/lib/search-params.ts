import type { WorkItemType } from '@repo/types';
import { WORK_ITEM_TYPES, parseWorkItemLabelsFilterParam } from '@repo/types';
import { ALL_PROJECTS_ID } from '@/app/board/_helpers/board-defaults-storage';

export interface RawSearchParams {
  page?: string;
  limit?: string;
  tab?: string;
  teamStatus?: string;
  search?: string;
  project?: string;
  sprint?: string;
  type?: string;
  assignee?: string;
  /** JSON array of exact label strings, e.g. `["Mobile","auth"]`. */
  labels?: string;
  fromProject?: string;
  fromAssignee?: string;
  /** Work-items list layout: flat (default) or hierarchy (roots + expand). */
  view?: string;
}

export interface ParsedStandardParams {
  page: number;
  limit: number;
  search: string;
}

export type WorkItemTypeFilter = WorkItemType;

export type WorkItemListView = 'flat' | 'hierarchy';

export interface ParsedWorkItemFilters {
  projectId?: string;
  sprintId?: string;
  type?: WorkItemTypeFilter;
  assigneeId?: string;
  /** Exact case-sensitive labels (OR containment). */
  labels?: string[];
}

const WORK_ITEM_TYPE_FILTERS = new Set<WorkItemTypeFilter>(WORK_ITEM_TYPES);

export function parseStandardParams(
  resolvedParams: RawSearchParams,
  defaultLimit = 10
): ParsedStandardParams {
  const page = Number.parseInt(resolvedParams.page ?? '1', 10);
  const limit = Number.parseInt(
    resolvedParams.limit ?? String(defaultLimit),
    10
  );
  const search = resolvedParams.search ?? '';
  return { page, limit, search };
}

/** Query sentinels that mean "no filter" (e.g. All Projects / All Sprints). */
function parseOptionalFilterId(value?: string): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed || trimmed === ALL_PROJECTS_ID) {
    return undefined;
  }
  return trimmed;
}

export function parseWorkItemFilters(
  resolvedParams: RawSearchParams
): ParsedWorkItemFilters {
  const projectId = parseOptionalFilterId(resolvedParams.project);
  const sprintId = parseOptionalFilterId(resolvedParams.sprint);
  const assigneeId = parseOptionalFilterId(resolvedParams.assignee);
  const rawType = resolvedParams.type?.trim();
  const type =
    rawType &&
    rawType !== ALL_PROJECTS_ID &&
    WORK_ITEM_TYPE_FILTERS.has(rawType as WorkItemTypeFilter)
      ? (rawType as WorkItemTypeFilter)
      : undefined;
  const labels = parseWorkItemLabelsFilterParam(resolvedParams.labels);

  return { projectId, sprintId, type, assigneeId, labels };
}

/** Work-items list view mode. Default is flat (all matching rows). */
export function parseWorkItemListView(value?: string | null): WorkItemListView {
  return value === 'hierarchy' ? 'hierarchy' : 'flat';
}

/**
 * Extra list filters for hierarchy mode (roots only).
 * Spread into `getWorkItemsPaginated` / `getWorkItems` filter objects.
 */
export function workItemHierarchyListFilter(
  listView: WorkItemListView
): { readonly parentId: null } | Record<string, never> {
  return listView === 'hierarchy' ? { parentId: null } : {};
}

export function parseTabStatus(tab?: string): 'active' | 'archived' {
  return tab === 'archived' ? 'archived' : 'active';
}

export type ProjectDetailsTab = 'details' | 'members' | 'teams' | 'work-items';

export function parseProjectDetailsTab(tab?: string | null): ProjectDetailsTab {
  if (tab === 'members' || tab === 'teams' || tab === 'work-items') {
    return tab;
  }
  return 'details';
}

export function parseTeamStatusFilter(
  value?: string | null
): 'active' | 'inactive' | 'archived' {
  if (value === 'archived') return 'archived';
  if (value === 'inactive') return 'inactive';
  return 'active';
}

export function parseManagerTabStatus(
  tab?: string
): 'active' | 'inactive' | 'archived' {
  if (tab === 'archived') return 'archived';
  if (tab === 'inactive') return 'inactive';
  return 'active';
}

export type UsersPageTab = 'users' | 'allowlist';

export function parseUsersPageTab(tab?: string | null): UsersPageTab {
  return tab === 'allowlist' ? 'allowlist' : 'users';
}
