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
  is(column: string, value: null): Q;
  in(column: string, values: readonly string[]): Q;
  or(filters: string): Q;
}
/* eslint-enable no-unused-vars */

/** Applies shared list filters used by Supabase list readers. */
export function applyWorkItemFilters<Q extends WorkItemFilterable<Q>>(
  query: Q,
  filters?: WorkItemListFilters
): Q {
  let next = query;
  next = next.eq('record_status', filters?.recordStatus ?? 'active');

  if (!filters) {
    return next;
  }

  if (filters.sprintId === null) {
    next = next.is('sprint_id', null);
  } else if (filters.sprintId) {
    next = next.eq('sprint_id', filters.sprintId);
  }

  if (filters.projectId) {
    if (filters.projectIds && !filters.projectIds.includes(filters.projectId)) {
      next = next.in('project_id', []);
    } else {
      next = next.eq('project_id', filters.projectId);
    }
  } else if (filters.projectIds) {
    next = next.in('project_id', [...filters.projectIds]);
  }

  if (filters.parentId === null) {
    next = next.is('parent_id', null);
  } else if (filters.parentId) {
    next = next.eq('parent_id', filters.parentId);
  }

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
