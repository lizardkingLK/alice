import { User as DbUser } from '@/app/users/_services/users.service';
import { createClient } from '@/lib/supabase/server';
import { pageRange, paginationMeta } from '@/lib/db/pagination';
import { throwIfError } from '@/lib/db/query';
import { Enums, Tables } from '@repo/types';

type DbUserEssentials = Pick<DbUser, 'id' | 'name' | 'email'>;

export type DbWorkItem = Tables<'work_items'> & {
  assignee: DbUserEssentials | null;
  reporter?: DbUserEssentials | null;
};

export type WorkItemListFilters = {
  sprintId?: string | null;
  projectId?: string;
  type?: Enums<'WorkItemType'>;
  assigneeId?: string;
};

export type GetWorkItemsPaginatedResponse = {
  workItems: DbWorkItem[];
  totalCount: number;
  page: number;
  limit: number;
  totalPages: number;
};

const ASSIGNEE_SELECT = 'assignee:users!assignee_id(id, name, email)';
const REPORTER_SELECT = 'reporter:users!reporter_id(id, name, email)';

// Structural shape of the Supabase builder's `.eq()` / `.is()`.
/* eslint-disable no-unused-vars */
interface WorkItemFilterable<Q> {
  eq(column: string, value: string): Q;
  is(column: string, value: null): Q;
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

  if (filters.type) {
    next = next.eq('type', filters.type);
  }

  if (filters.assigneeId) {
    next = next.eq('assignee_id', filters.assigneeId);
  }

  return next;
}

/**
 * Server-only reads that query Supabase directly from the RSC layer,
 * skipping the `web → api` hop. Mutations still go through the API
 * (see `workItem.service.client.ts`).
 */

export async function getWorkItems(
  filters?: WorkItemListFilters
): Promise<DbWorkItem[]> {
  const supabase = await createClient();

  const query = applyWorkItemFilters(
    supabase.from('work_items').select(`*, ${ASSIGNEE_SELECT}`),
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
  const { from, to } = pageRange(page, limit);

  let query = applyWorkItemFilters(
    supabase
      .from('work_items')
      .select(`*, ${ASSIGNEE_SELECT}`, { count: 'exact' }),
    filters
  );

  if (search?.trim()) {
    query = query.ilike('title', `%${search.trim()}%`);
  }

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(from, to);

  throwIfError(
    error,
    'failed to list work-items paginated',
    'Failed to list work-items'
  );

  return {
    workItems: (data ?? []) as unknown as DbWorkItem[],
    ...paginationMeta(count ?? 0, page, limit),
  };
}

export async function getWorkItem(workItemId: string): Promise<DbWorkItem> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('work_items')
    .select(`*, ${ASSIGNEE_SELECT}, ${REPORTER_SELECT}`)
    .eq('id', workItemId)
    .maybeSingle();

  throwIfError(error, 'failed to get work-item', 'Failed to get work-item');

  return data as unknown as DbWorkItem;
}
