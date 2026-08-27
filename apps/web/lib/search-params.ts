import type { WorkItemType } from '@repo/types';
import { WORK_ITEM_TYPES, parseWorkItemLabelsFilterParam } from '@repo/types';
import { ALL_PROJECTS_ID } from '@/app/board/_helpers/board-defaults-storage';

export interface RawSearchParams {
  page?: string;
  limit?: string;
  tab?: string;
  /** Work-item lifecycle list filter (`active` | `archived`). */
  recordStatus?: string;
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

/**
 * Work-item Active/Archived list filter.
 * Prefers `recordStatus` so it does not collide with page-level `tab`
 * (e.g. project details `?tab=work-items`).
 * Falls back to legacy `/work-items?tab=archived`.
 */
export function parseWorkItemRecordStatus(params: {
  readonly recordStatus?: string | null;
  readonly tab?: string | null;
}): 'active' | 'archived' {
  if (params.recordStatus === 'archived' || params.recordStatus === 'active') {
    return params.recordStatus;
  }
  if (params.tab === 'archived' || params.tab === 'active') {
    return params.tab;
  }
  return 'active';
}

/** Views workspace tabs (My / Shared with me / Archived). */
export type ViewsListTab = 'mine' | 'shared' | 'archived';

export function parseViewsListTab(tab?: string | null): ViewsListTab {
  if (tab === 'shared' || tab === 'archived') {
    return tab;
  }
  return 'mine';
}

export type ProjectDetailsTab =
  'details' | 'members' | 'teams' | 'work-items' | 'integrations';

export function parseProjectDetailsTab(tab?: string | null): ProjectDetailsTab {
  if (
    tab === 'members' ||
    tab === 'teams' ||
    tab === 'work-items' ||
    tab === 'integrations'
  ) {
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

/** Board page tabs (`/board?tab=`). Default `board` omits the query param. */
export type BoardPageTab = 'board' | 'calendar';

export function parseBoardPageTab(tab?: string | null): BoardPageTab {
  return tab === 'calendar' ? 'calendar' : 'board';
}

/** Account settings page tabs (`/settings?tab=`). */
export type SettingsTab =
  'general' | 'security' | 'notifications' | 'preferences';

export function parseSettingsTab(tab?: string | null): SettingsTab {
  if (tab === 'security' || tab === 'notifications' || tab === 'preferences') {
    return tab;
  }
  return 'general';
}

/**
 * Users and allowlist share `/users` query params. Only the active tab
 * should consume `page` / `search`; the other list stays on page 1.
 */
export function listParamsForUsersPageTab(
  parsed: ParsedStandardParams,
  activeTab: UsersPageTab,
  targetTab: UsersPageTab
): ParsedStandardParams {
  if (activeTab === targetTab) {
    return parsed;
  }

  return { page: 1, limit: parsed.limit, search: '' };
}
