import { createClient } from '@/lib/supabase/server';
import { runPaginatedSelect, throwIfError } from '@/lib/db/query';
import {
  workItemDetailPostgrestSelect,
  workItemListSelect,
} from '@/app/work-items/_helpers/work-item-list-select';
import {
  buildWorkItemLabelsOrFilter,
  buildWorkItemSearchOrFilter,
} from '@repo/types';
import type {
  DbWorkItem,
  GetWorkItemsOptions,
  GetWorkItemsPaginatedResponse,
  WorkItemAncestor,
  WorkItemListFilters,
} from '@/app/work-items/_types/work-items.reads.types';

/** Max hops above a leaf Issue (Task → Story → Epic). */
const MAX_ANCESTOR_DEPTH = 3;

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
  parentId: WorkItemListFilters['parentId']
): Q {
  if (parentId === null) {
    return query.is('parent_id', null);
  }
  if (parentId) {
    return query.eq('parent_id', parentId);
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
  next = applyParentIdFilter(next, filters.parentId);

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
  options?: GetWorkItemsOptions
): Promise<DbWorkItem[]> {
  const supabase = await createClient();
  const includeDescription = options?.includeDescription ?? false;

  const query = applyWorkItemFilters(
    supabase.from('work_items').select(workItemListSelect(includeDescription)),
    filters
  );

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

  return { workItems, ...meta };
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

  return (data as unknown as DbWorkItem | null) ?? null;
}

/**
 * Walk `parent_id` upward and return ancestors root-first
 * (Epic → … → immediate parent). Caps at hierarchy depth.
 */
export async function getWorkItemAncestorsFromSupabase(
  parentId: string | null | undefined
): Promise<WorkItemAncestor[]> {
  if (!parentId) {
    return [];
  }

  const supabase = await createClient();
  const chain: WorkItemAncestor[] = [];
  let currentParentId: string | null = parentId;

  for (let depth = 0; depth < MAX_ANCESTOR_DEPTH && currentParentId; depth++) {
    const { data, error } = await supabase
      .from('work_items')
      .select('id, type, title, parent_id')
      .eq('id', currentParentId)
      .maybeSingle();

    throwIfError(
      error,
      'failed to get work-item ancestors',
      'Failed to get work-item ancestors'
    );

    if (!data) {
      break;
    }

    const ancestor = data as WorkItemAncestor;
    chain.push(ancestor);
    currentParentId = ancestor.parent_id;
  }

  return chain.reverse();
}
