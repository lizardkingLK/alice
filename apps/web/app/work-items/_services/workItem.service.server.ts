import { User as DbUser } from '@/app/users/_services/users.service';
import { createClient } from '@/lib/supabase/server';
import { pageRange, paginationMeta } from '@/lib/db/pagination';
import { Tables } from '@repo/types';

type DbUserEssentials = Pick<DbUser, 'id' | 'name' | 'email'>;

export type DbWorkItem = Tables<'work_items'> & {
  assignee: DbUserEssentials | null;
  reporter?: DbUserEssentials | null;
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

/**
 * Server-only reads that query Supabase directly from the RSC layer,
 * skipping the `web → api` hop. Mutations still go through the API
 * (see `workItem.service.client.ts`).
 */

export async function getWorkItems(filters?: {
  sprintId?: string | null;
}): Promise<DbWorkItem[]> {
  const supabase = await createClient();

  let query = supabase.from('work_items').select(`*, ${ASSIGNEE_SELECT}`);

  if (filters) {
    if (filters.sprintId === null) {
      query = query.is('sprint_id', null);
    } else if (filters.sprintId) {
      query = query.eq('sprint_id', filters.sprintId);
    }
  }

  const { data, error } = await query.order('created_at', {
    ascending: false,
  });

  if (error) {
    console.error('error. failed to list work-items:', error.message);
    throw new Error('Failed to list work-items');
  }

  return (data ?? []) as unknown as DbWorkItem[];
}

export async function getWorkItemsPaginated(
  page: number,
  limit: number,
  search?: string,
  filters?: { sprintId?: string | null }
): Promise<GetWorkItemsPaginatedResponse> {
  const supabase = await createClient();
  const { from, to } = pageRange(page, limit);

  let query = supabase
    .from('work_items')
    .select(`*, ${ASSIGNEE_SELECT}`, { count: 'exact' });

  if (search?.trim()) {
    query = query.ilike('title', `%${search.trim()}%`);
  }

  if (filters) {
    if (filters.sprintId === null) {
      query = query.is('sprint_id', null);
    } else if (filters.sprintId) {
      query = query.eq('sprint_id', filters.sprintId);
    }
  }

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) {
    console.error('error. failed to list work-items paginated:', error.message);
    throw new Error('Failed to list work-items');
  }

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

  if (error) {
    console.error('error. failed to get work-item:', error.message);
    throw new Error('Failed to get work-item');
  }

  return data as unknown as DbWorkItem;
}
