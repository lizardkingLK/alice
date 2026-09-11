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
} from './sprints.mutations.client';

const SPRINT_WITH_PROJECT = `*, ${projectRelationSelect()}`;

const EMPTY_PAGINATION = (
  page: number,
  limit: number
): PaginatedSprints['pagination'] => ({
  page,
  limit,
  totalCount: 0,
  totalPages: 1,
});

export type GetSprintsPaginatedOptions = {
  readonly projectId?: string;
  /** When set, list is limited to these project IDs (accessible scope). */
  readonly projectIds?: readonly string[];
};

/**
 * Reads query Supabase directly from the RSC layer to skip the `web → api`
 * hop. Sprint mutations still go through the API.
 */
export async function getSprintsPaginatedServer(
  tab?: 'active' | 'archived',
  page: number = 1,
  limit: number = 5,
  search?: string,
  options?: GetSprintsPaginatedOptions
): Promise<PaginatedSprints> {
  const projectIds = options?.projectIds;
  const projectId = options?.projectId;

  if (projectIds && projectIds.length === 0) {
    return { sprints: [], pagination: EMPTY_PAGINATION(page, limit) };
  }

  if (projectId && projectIds && !projectIds.includes(projectId)) {
    return { sprints: [], pagination: EMPTY_PAGINATION(page, limit) };
  }

  const supabase = await createClient();

  let query = supabase
    .from('sprints')
    .select(SPRINT_WITH_PROJECT, { count: 'exact' });

  if (tab === 'archived') {
    query = query.in('status', ['archived']);
  } else {
    query = query.in('status', ['planned', 'active', 'closed']);
  }

  if (projectId) {
    query = query.eq('project_id', projectId);
  } else if (projectIds) {
    query = query.in('project_id', [...projectIds]);
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
    sprints: rows.map((row) => mapDbSprintToSprint(row)),
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
