import { createClient } from '@/lib/supabase/server';
import { pageRange, paginationMeta } from '@/lib/db/pagination';
import { applyListSearch, throwIfError } from '@/lib/db/query';
import {
  mapDbSprintToSprint,
  type DbSprintRelation,
  type PaginatedSprints,
  type Sprint,
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
  const { from, to } = pageRange(page, limit);

  let query = supabase
    .from('sprints')
    .select('*, project:projects(id, name, key)', { count: 'exact' });

  if (tab === 'archived') {
    query = query.in('status', ['archived']);
  } else {
    query = query.in('status', ['planned', 'active', 'closed']);
  }

  query = applyListSearch(query, search, ['name', 'goal']);

  const { data, error, count } = await query
    .order('start_date', { ascending: false })
    .range(from, to);

  throwIfError(error, 'failed to list sprints', 'Failed to list sprints');

  const rows = (data ?? []) as unknown as DbSprintRelation[];

  return {
    sprints: rows.map(mapDbSprintToSprint),
    pagination: paginationMeta(count ?? 0, page, limit),
  };
}

/** Mirrors `sprintsRepository.findById` — same select and mapping as the list reader. */
export async function getSprint(sprintId: string): Promise<Sprint | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('sprints')
    .select('*, project:projects(id, name, key)')
    .eq('id', sprintId)
    .maybeSingle();

  throwIfError(error, 'failed to find sprint', 'Failed to find sprint');

  if (!data) {
    return null;
  }

  return mapDbSprintToSprint(data as unknown as DbSprintRelation);
}
