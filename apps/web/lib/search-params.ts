import type { WorkItemType } from '@repo/types';
import { WORK_ITEM_TYPES } from '@repo/types';

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
  fromProject?: string;
  fromAssignee?: string;
}

export interface ParsedStandardParams {
  page: number;
  limit: number;
  search: string;
}

export type WorkItemTypeFilter = WorkItemType;

export interface ParsedWorkItemFilters {
  projectId?: string;
  sprintId?: string;
  type?: WorkItemTypeFilter;
  assigneeId?: string;
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

export function parseWorkItemFilters(
  resolvedParams: RawSearchParams
): ParsedWorkItemFilters {
  const projectId = resolvedParams.project?.trim() || undefined;
  const sprintId = resolvedParams.sprint?.trim() || undefined;
  const assigneeId = resolvedParams.assignee?.trim() || undefined;
  const rawType = resolvedParams.type?.trim();
  const type =
    rawType && WORK_ITEM_TYPE_FILTERS.has(rawType as WorkItemTypeFilter)
      ? (rawType as WorkItemTypeFilter)
      : undefined;

  return { projectId, sprintId, type, assigneeId };
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
