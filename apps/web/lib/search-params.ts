export interface RawSearchParams {
  page?: string;
  limit?: string;
  tab?: string;
  search?: string;
  project?: string;
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

export type WorkItemTypeFilter = 'Epic' | 'Story' | 'Task';

export interface ParsedWorkItemFilters {
  projectId?: string;
  type?: WorkItemTypeFilter;
  assigneeId?: string;
}

const WORK_ITEM_TYPES = new Set<WorkItemTypeFilter>(['Epic', 'Story', 'Task']);

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
  const assigneeId = resolvedParams.assignee?.trim() || undefined;
  const rawType = resolvedParams.type?.trim();
  const type =
    rawType && WORK_ITEM_TYPES.has(rawType as WorkItemTypeFilter)
      ? (rawType as WorkItemTypeFilter)
      : undefined;

  return { projectId, type, assigneeId };
}

export function parseTabStatus(tab?: string): 'active' | 'archived' {
  return tab === 'archived' ? 'archived' : 'active';
}

export type ProjectDetailsTab = 'details' | 'members' | 'work-items';

export function parseProjectDetailsTab(tab?: string | null): ProjectDetailsTab {
  if (tab === 'members' || tab === 'work-items') {
    return tab;
  }
  return 'details';
}

export function parseManagerTabStatus(
  tab?: string
): 'active' | 'inactive' | 'archived' {
  if (tab === 'archived') return 'archived';
  if (tab === 'inactive') return 'inactive';
  return 'active';
}
