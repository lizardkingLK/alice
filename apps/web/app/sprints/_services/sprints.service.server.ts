import { createClient } from '@/lib/supabase/server';
import {
  mapDbSprintToSprint,
  type DbSprintRelation,
  type PaginatedSprints,
} from './sprints.service';

/**
 * Reads query Supabase directly from the RSC layer to skip the `web → api`
 * hop. Sprint mutations still go through the API.
 */
export async function getSprintsPaginatedServer(
  tab?: 'active' | 'archived',
  page: number = 1,
  limit: number = 5,
  search?: string
): Promise<PaginatedSprints> {
  const supabase = await createClient();

  const from = (page - 1) * limit;
  const to = page * limit - 1;

  let query = supabase
    .from('sprints')
    .select('*, project:projects(id, name, key)', { count: 'exact' });

  if (tab === 'archived') {
    query = query.in('status', ['archived']);
  } else {
    query = query.in('status', ['planned', 'active', 'closed']);
  }

  if (search) {
    const sanitized = `%${search}%`;
    query = query.or(`name.ilike.${sanitized},goal.ilike.${sanitized}`);
  }

  const { data, error, count } = await query
    .order('start_date', { ascending: false })
    .range(from, to);

  if (error) {
    console.error('error. failed to list sprints:', error.message);
    throw new Error('Failed to list sprints');
  }

  const totalCount = count ?? 0;
  const rows = (data ?? []) as unknown as DbSprintRelation[];

  return {
    sprints: rows.map(mapDbSprintToSprint),
    pagination: {
      page,
      limit,
      totalCount,
      totalPages: Math.max(1, Math.ceil(totalCount / limit)),
    },
  };
}
