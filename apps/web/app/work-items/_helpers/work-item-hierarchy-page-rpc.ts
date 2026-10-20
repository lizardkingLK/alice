import type {
  WorkItemAncestor,
  WorkItemListFilters,
} from '@/app/work-items/_types/work-items.reads.types';
import { HIERARCHY_FOREST_PAGE_SIZE } from '@/app/work-items/_helpers/work-item-hierarchy-forest';

/** Wire shape returned by `public.get_work_items_hierarchy_page`. */
export type HierarchyPageRpcPayload = {
  readonly mode: 'tree' | 'search';
  readonly page: number;
  readonly limit: number;
  readonly total_count: number;
  readonly total_pages: number;
  readonly focus_id: string | null;
  readonly table_ids: readonly string[];
  readonly page_ids: readonly string[];
  readonly panel_ids: readonly string[];
  readonly match_ids: readonly string[];
  readonly ancestors_by_id: Record<string, WorkItemAncestor[]>;
};

export type HierarchyPageRpcArgs = {
  readonly page: number;
  readonly pageSize: number;
  readonly search?: string | null;
  readonly focusId?: string | null;
  readonly filters?: WorkItemListFilters;
};

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is string => typeof entry === 'string');
}

function asAncestorsById(value: unknown): Record<string, WorkItemAncestor[]> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  const next: Record<string, WorkItemAncestor[]> = {};
  for (const [id, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!Array.isArray(raw)) {
      continue;
    }
    next[id] = raw.filter(
      (entry): entry is WorkItemAncestor =>
        Boolean(entry) &&
        typeof entry === 'object' &&
        typeof (entry as WorkItemAncestor).id === 'string' &&
        typeof (entry as WorkItemAncestor).title === 'string' &&
        typeof (entry as WorkItemAncestor).type === 'string'
    );
  }
  return next;
}

/** Parse jsonb RPC result; returns null when the payload is unusable. */
export function parseHierarchyPageRpcPayload(
  data: unknown
): HierarchyPageRpcPayload | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return null;
  }
  const row = data as Record<string, unknown>;
  const mode = row.mode === 'search' ? 'search' : 'tree';
  const page = typeof row.page === 'number' ? row.page : 1;
  const limit =
    typeof row.limit === 'number' ? row.limit : HIERARCHY_FOREST_PAGE_SIZE;
  const totalCount = typeof row.total_count === 'number' ? row.total_count : 0;
  const totalPages = typeof row.total_pages === 'number' ? row.total_pages : 1;

  return {
    mode,
    page,
    limit,
    total_count: totalCount,
    total_pages: totalPages,
    focus_id: typeof row.focus_id === 'string' ? row.focus_id : null,
    table_ids: asStringArray(row.table_ids),
    page_ids: asStringArray(row.page_ids),
    panel_ids: asStringArray(row.panel_ids),
    match_ids: asStringArray(row.match_ids),
    ancestors_by_id: asAncestorsById(row.ancestors_by_id),
  };
}

/** Map app list filters → RPC args (parentId stripped by caller). */
export function buildHierarchyPageRpcArgs(
  options: HierarchyPageRpcArgs
): Record<string, unknown> {
  const filters = options.filters;
  const sprintId = filters?.sprintId;
  const labels = filters?.labels?.length ? filters.labels : null;

  return {
    p_page: Math.max(1, options.page),
    p_page_size: Math.max(1, options.pageSize),
    p_record_status: filters?.recordStatus ?? 'active',
    p_project_id: filters?.projectId ?? null,
    p_project_ids: filters?.projectIds ? [...filters.projectIds] : null,
    p_sprint_id: typeof sprintId === 'string' ? sprintId : null,
    p_sprint_is_null: sprintId === null,
    p_type: filters?.type ?? null,
    p_assignee_id: filters?.assigneeId ?? null,
    p_labels: labels,
    p_search: options.search?.trim() || null,
    p_focus_id: options.focusId?.trim() || null,
  };
}
