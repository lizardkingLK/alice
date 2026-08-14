import { createClient } from '@/lib/supabase/server';
import {
  runPaginatedSelect,
  applyListSearch,
  throwIfError,
} from '@/lib/db/query';
import { projectRelationSelect } from '@repo/types';
import {
  mapDbSprintToSprint,
  type DbSprintRelation,
  type PaginatedSprints,
  type Sprint,
} from './sprints.service';

const SPRINT_WITH_PROJECT = `*, ${projectRelationSelect()}`;

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

  let query = supabase
    .from('sprints')
    .select(SPRINT_WITH_PROJECT, { count: 'exact' });

  if (tab === 'archived') {
    query = query.in('status', ['archived']);
  } else {
    query = query.in('status', ['planned', 'active', 'closed']);
  }

  query = applyListSearch(query, search, ['name', 'goal']);

  const { rows, ...meta } = await runPaginatedSelect<DbSprintRelation>(
    query,
    page,
    limit,
    {
      orderBy: 'start_date',
      logLabel: 'failed to list sprints',
      errorMessage: 'Failed to list sprints',
    }
  );

  return {
    sprints: rows.map(mapDbSprintToSprint),
    pagination: meta,
  };
}

/** Mirrors `sprintsRepository.findById` — same select and mapping as the list reader. */
export async function getSprint(sprintId: string): Promise<Sprint | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('sprints')
    .select(SPRINT_WITH_PROJECT)
    .eq('id', sprintId)
    .maybeSingle();

  throwIfError(error, 'failed to find sprint', 'Failed to find sprint');

  if (!data) {
    return null;
  }

  return mapDbSprintToSprint(data as unknown as DbSprintRelation);
}
