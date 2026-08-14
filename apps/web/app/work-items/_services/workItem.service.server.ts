import { cache } from 'react';
import { User as DbUser } from '@/app/users/_services/users.service';
import { createClient } from '@/lib/supabase/server';
import { runPaginatedSelect, throwIfError } from '@/lib/db/query';
import {
  ASSIGNEE_SELECT,
  REPORTER_SELECT,
  workItemListSelect,
} from '@/app/work-items/_helpers/work-item-list-select';
import {
  Enums,
  Tables,
  buildWorkItemLabelsOrFilter,
  buildWorkItemSearchOrFilter,
  projectRelationSelect,
} from '@repo/types';

type DbUserEssentials = Pick<DbUser, 'id' | 'name' | 'email'> & {
  profile_picture?: string | null;
};

export type DbWorkItem = Tables<'work_items'> & {
  assignee: DbUserEssentials | null;
  reporter?: DbUserEssentials | null;
  project?: {
    id: string;
    key: string;
    name: string;
  } | null;
  sprint?: {
    id: string;
    name: string;
  } | null;
};

export type WorkItemListFilters = {
  sprintId?: string | null;
  projectId?: string;
  /** Exact parent, or `null` for unparented (orphan) items. */
  parentId?: string | null;
  type?: Enums<'WorkItemType'>;
  assigneeId?: string;
  /** Exact case-sensitive labels; match if the item contains any (OR). */
  labels?: string[];
};

export type GetWorkItemsPaginatedResponse = {
  workItems: DbWorkItem[];
  totalCount: number;
  page: number;
  limit: number;
  totalPages: number;
};

const PROJECT_SELECT = projectRelationSelect();

export type GetWorkItemsOptions = {
  readonly includeDescription?: boolean;
};

// Structural shape of the Supabase builder's `.eq()` / `.is()` / `.or()`.
/* eslint-disable no-unused-vars */
interface WorkItemFilterable<Q> {
  eq(column: string, value: string): Q;
  is(column: string, value: null): Q;
  or(filters: string): Q;
}
/* eslint-enable no-unused-vars */

/** Applies shared list filters used by both paginated and unpaginated readers. */
export function applyWorkItemFilters<Q extends WorkItemFilterable<Q>>(
  query: Q,
  filters?: WorkItemListFilters
): Q {
  if (!filters) {
    return query;
  }

  let next = query;

  if (filters.sprintId === null) {
    next = next.is('sprint_id', null);
  } else if (filters.sprintId) {
    next = next.eq('sprint_id', filters.sprintId);
  }

  if (filters.projectId) {
    next = next.eq('project_id', filters.projectId);
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
 * Server-only reads that query Supabase directly from the RSC layer,
 * skipping the `web → api` hop. Mutations still go through the API
 * (see `workItem.service.client.ts`).
 */

export async function getWorkItems(
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

export async function getWorkItemsPaginated(
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

export const getWorkItem = cache(
  async (workItemId: string): Promise<DbWorkItem | null> => {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('work_items')
      .select(
        `*, ${ASSIGNEE_SELECT}, ${REPORTER_SELECT}, ${PROJECT_SELECT}, sprint:sprints(id, name)`
      )
      .eq('id', workItemId)
      .maybeSingle();

    throwIfError(error, 'failed to get work-item', 'Failed to get work-item');

    return (data as unknown as DbWorkItem | null) ?? null;
  }
);

/** Minimal ancestor fields for the in-page hierarchy path. */
export type WorkItemAncestor = Pick<
  DbWorkItem,
  'id' | 'type' | 'title' | 'parent_id'
>;

/** Max hops above a leaf Issue (Task → Story → Epic). */
const MAX_ANCESTOR_DEPTH = 3;

/**
 * Walk `parent_id` upward and return ancestors root-first
 * (Epic → … → immediate parent). Caps at hierarchy depth.
 */
export async function getWorkItemAncestors(
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
