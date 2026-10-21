import { createClient } from '@/lib/supabase/server';
import {
  isMissingRpcError,
  runPaginatedSelect,
  throwIfError,
} from '@/lib/db/query';
import {
  workItemDetailPostgrestSelect,
  workItemListSelect,
} from '@/app/work-items/_helpers/work-item-list-select';
import {
  buildWorkItemLabelsOrFilter,
  buildWorkItemSearchOrFilter,
  withJiraIssueKeyDtoField,
} from '@repo/types';
import type {
  DbWorkItem,
  GetWorkItemsHierarchyPageResponse,
  GetWorkItemsOptions,
  GetWorkItemsPaginatedResponse,
  WorkItemAncestor,
  WorkItemListFilters,
} from '@/app/work-items/_types/work-items.reads.types';
import {
  flattenWorkItemAncestorEmbed,
  WORK_ITEM_ANCESTOR_EMBED_SELECT,
  type WorkItemAncestorEmbedRow,
} from '@/app/work-items/_helpers/work-item-ancestors';
import { seedForestChildrenByParentId } from '@/app/work-items/_helpers/work-item-hierarchy-children';
import {
  HIERARCHY_FOREST_PAGE_SIZE,
  indexWorkItemsById,
} from '@/app/work-items/_helpers/work-item-hierarchy-forest';
import {
  buildHierarchyPageRpcArgs,
  parseHierarchyPageRpcPayload,
} from '@/app/work-items/_helpers/work-item-hierarchy-page-rpc';

// Structural shape of the Supabase builder's `.eq()` / `.is()` / `.in()` / `.or()`.
/* eslint-disable no-unused-vars */
interface WorkItemFilterable<Q> {
  eq(column: string, value: string): Q;
  neq(column: string, value: string): Q;
  is(column: string, value: null): Q;
  not(column: string, operator: 'is', value: null): Q;
  in(column: string, values: readonly string[]): Q;
  or(filters: string): Q;
  gte(column: string, value: string): Q;
  lte(column: string, value: string): Q;
}
/* eslint-enable no-unused-vars */

function applySprintIdFilter<Q extends WorkItemFilterable<Q>>(
  query: Q,
  sprintId: WorkItemListFilters['sprintId']
): Q {
  if (sprintId === null) {
    return query.is('sprint_id', null);
  }
  if (sprintId) {
    return query.eq('sprint_id', sprintId);
  }
  return query;
}

function applyProjectFilters<Q extends WorkItemFilterable<Q>>(
  query: Q,
  filters: Pick<WorkItemListFilters, 'projectId' | 'projectIds'>
): Q {
  if (filters.projectId) {
    if (filters.projectIds && !filters.projectIds.includes(filters.projectId)) {
      return query.in('project_id', []);
    }
    return query.eq('project_id', filters.projectId);
  }
  if (filters.projectIds) {
    return query.in('project_id', [...filters.projectIds]);
  }
  return query;
}

function applyParentIdFilter<Q extends WorkItemFilterable<Q>>(
  query: Q,
  filters: Pick<WorkItemListFilters, 'parentId' | 'parentIds'>
): Q {
  if (filters.parentIds?.length) {
    return query.in('parent_id', [...filters.parentIds]);
  }
  if (filters.parentId === null) {
    return query.is('parent_id', null);
  }
  if (filters.parentId) {
    return query.eq('parent_id', filters.parentId);
  }
  return query;
}

function applyIdsFilter<Q extends WorkItemFilterable<Q>>(
  query: Q,
  ids: WorkItemListFilters['ids']
): Q {
  if (ids?.length) {
    return query.in('id', [...ids]);
  }
  return query;
}

function applyDueDateFilter<Q extends WorkItemFilterable<Q>>(
  query: Q,
  dueDate: WorkItemListFilters['dueDate']
): Q {
  if (dueDate === 'null') {
    return query.is('due_date', null);
  }
  if (dueDate === 'not_null') {
    return query.not('due_date', 'is', null);
  }
  if (dueDate && typeof dueDate === 'object') {
    return query.gte('due_date', dueDate.from).lte('due_date', dueDate.to);
  }
  return query;
}

function applyExcludeStatusesFilter<Q extends WorkItemFilterable<Q>>(
  query: Q,
  excludeStatuses: WorkItemListFilters['excludeStatuses']
): Q {
  if (!excludeStatuses?.length) {
    return query;
  }
  let next = query;
  for (const status of excludeStatuses) {
    next = next.neq('status', status);
  }
  return next;
}

/** Applies shared list filters used by Supabase list readers. */
export function applyWorkItemFilters<Q extends WorkItemFilterable<Q>>(
  query: Q,
  filters?: WorkItemListFilters
): Q {
  let next = query.eq('record_status', filters?.recordStatus ?? 'active');

  if (!filters) {
    return next;
  }

  next = applySprintIdFilter(next, filters.sprintId);
  next = applyProjectFilters(next, filters);
  next = applyParentIdFilter(next, filters);
  next = applyIdsFilter(next, filters.ids);

  if (filters.type) {
    next = next.eq('type', filters.type);
  }

  if (filters.assigneeId) {
    next = next.eq('assignee_id', filters.assigneeId);
  }

  const labelsOr = filters.labels?.length
    ? buildWorkItemLabelsOrFilter(filters.labels)
    : null;
  if (labelsOr) {
    next = next.or(labelsOr);
  }

  next = applyDueDateFilter(next, filters.dueDate);
  next = applyExcludeStatusesFilter(next, filters.excludeStatuses);

  return next;
}

/**
 * Default RSC read path: supabase-js direct to Postgres (no Express hop).
 */
export async function getWorkItemsFromSupabase(
  filters?: WorkItemListFilters,
  options?: GetWorkItemsOptions & { readonly search?: string }
): Promise<DbWorkItem[]> {
  const supabase = await createClient();
  const includeDescription = options?.includeDescription ?? false;

  let query = applyWorkItemFilters(
    supabase.from('work_items').select(workItemListSelect(includeDescription)),
    filters
  );

  const search = options?.search?.trim();
  if (search) {
    query = query.or(buildWorkItemSearchOrFilter(search));
  }

  const { data, error } = await query.order('created_at', {
    ascending: false,
  });

  throwIfError(error, 'failed to list work-items', 'Failed to list work-items');

  return (data ?? []) as unknown as DbWorkItem[];
}

export async function listWorkItemsPaginatedFromSupabase(
  page: number,
  limit: number,
  search?: string,
  filters?: WorkItemListFilters
): Promise<GetWorkItemsPaginatedResponse> {
  const supabase = await createClient();

  let query = applyWorkItemFilters(
    supabase
      .from('work_items')
      .select(workItemListSelect(false), { count: 'exact' }),
    filters
  );

  if (search?.trim()) {
    query = query.or(buildWorkItemSearchOrFilter(search));
  }

  const { rows: workItems, ...meta } = await runPaginatedSelect<DbWorkItem>(
    query,
    page,
    limit,
    {
      orderBy: 'created_at',
      logLabel: 'failed to list work-items paginated',
      errorMessage: 'Failed to list work-items',
    }
  );

  return {
    workItems: workItems.map((row) => withJiraIssueKeyDtoField(row)),
    ...meta,
  };
}

export async function getWorkItemFromSupabase(
  workItemId: string
): Promise<DbWorkItem | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('work_items')
    .select(workItemDetailPostgrestSelect())
    .eq('id', workItemId)
    .maybeSingle();

  throwIfError(error, 'failed to get work-item', 'Failed to get work-item');

  if (!data) {
    return null;
  }

  return withJiraIssueKeyDtoField(data as unknown as DbWorkItem);
}

/**
 * Load ancestors root-first (Epic → … → immediate parent) in one PostgREST
 * round-trip via nested `parent` embeds (capped at hierarchy depth).
 */
export async function getWorkItemAncestorsFromSupabase(
  parentId: string | null | undefined
): Promise<WorkItemAncestor[]> {
  if (!parentId) {
    return [];
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('work_items')
    .select(WORK_ITEM_ANCESTOR_EMBED_SELECT)
    .eq('id', parentId)
    .maybeSingle();

  throwIfError(
    error,
    'failed to get work-item ancestors',
    'Failed to get work-item ancestors'
  );

  return flattenWorkItemAncestorEmbed(data as WorkItemAncestorEmbedRow | null);
}

function orderByIds(
  ids: readonly string[],
  byId: ReadonlyMap<string, DbWorkItem>
): DbWorkItem[] {
  const ordered: DbWorkItem[] = [];
  for (const id of ids) {
    const item = byId.get(id);
    if (item) {
      ordered.push(item);
    }
  }
  return ordered;
}

/**
 * Hierarchy page via `get_work_items_hierarchy_page` RPC + list-row hydrate.
 * Returns null when the function is missing (pre-migrate) so callers can fall back.
 */
export async function getWorkItemsHierarchyPageFromRpc(
  page: number,
  limit: number,
  search?: string,
  filters?: WorkItemListFilters,
  focusId?: string | null
): Promise<GetWorkItemsHierarchyPageResponse | null> {
  const supabase = await createClient();
  const trimmedSearch = search?.trim() || null;
  const pageSize = trimmedSearch
    ? Math.max(1, limit)
    : HIERARCHY_FOREST_PAGE_SIZE;

  const { data, error } = await supabase.rpc('get_work_items_hierarchy_page', {
    ...buildHierarchyPageRpcArgs({
      page,
      pageSize,
      search: trimmedSearch,
      focusId,
      filters,
    }),
  });

  if (error) {
    if (isMissingRpcError(error)) {
      return null;
    }
    throwIfError(
      error,
      'failed to get work-items hierarchy page',
      'Failed to list work-items hierarchy'
    );
  }

  const payload = parseHierarchyPageRpcPayload(data);
  if (!payload) {
    return null;
  }

  const hydrateIds = [
    ...new Set([
      ...payload.table_ids,
      ...payload.page_ids,
      ...payload.panel_ids,
    ]),
  ];

  const hydrated =
    hydrateIds.length === 0
      ? []
      : await getWorkItemsFromSupabase({
          ids: hydrateIds,
          recordStatus: filters?.recordStatus,
          projectId: filters?.projectId,
          projectIds: filters?.projectIds,
        });
  const byId = indexWorkItemsById(hydrated);

  const pageItems = orderByIds(payload.page_ids, byId);
  const panelItems = orderByIds(payload.panel_ids, byId);
  // Always seed every known id (including `[]`) so expand never refetches
  // nodes already returned by the hierarchy page / panel.
  const childrenByParentId = seedForestChildrenByParentId(
    payload.mode === 'search' && panelItems.length > 0 ? panelItems : pageItems
  );

  return {
    workItems: orderByIds(payload.table_ids, byId),
    totalCount: payload.total_count,
    page: payload.page,
    limit: payload.limit,
    totalPages: payload.total_pages,
    childrenByParentId,
    mode: payload.mode,
    searchPanelItems: panelItems,
    searchMatchIds: payload.match_ids,
    ancestorsById: payload.ancestors_by_id,
    focusId: payload.focus_id,
  };
}
