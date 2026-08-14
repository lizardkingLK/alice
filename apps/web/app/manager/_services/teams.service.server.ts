import { apiFetch } from '@/lib/api/api-client.server';
import { createClient } from '@/lib/supabase/server';
import { pageRange, paginationMeta } from '@/lib/db/pagination';
import { applyListSearch, throwIfError } from '@/lib/db/query';
import { createTeamsService } from './teams.service.base';
import type { GetTeamsPaginatedResponse, Team } from './teams.service.base';

const service = createTeamsService(apiFetch);

const TEAM_LIST_SELECT =
  '*, manager:users!teams_manager_id_fkey(id, name, email), members:team_members(*)';

const TEAM_LIST_SEARCH_FIELDS = ['name', 'description', 'tech_stack'] as const;

/**
 * Reads query Supabase directly from the RSC layer to skip the `web → api`
 * hop. Mutations still go through the API.
 */

export async function getTeamListPaginated(
  page: number,
  limit: number,
  status?: 'active' | 'inactive' | 'archived' | 'deleted',
  search?: string,
  projectId?: string
): Promise<GetTeamsPaginatedResponse> {
  const supabase = await createClient();
  const { from, to } = pageRange(page, limit);

  let query = supabase
    .from('teams')
    .select(TEAM_LIST_SELECT, { count: 'exact' });

  if (status) {
    query = query.eq('status', status);
  }

  query = applyListSearch(query, search, [...TEAM_LIST_SEARCH_FIELDS]);

  if (projectId) {
    query = query.eq('project_id', projectId);
  }

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(from, to);

  throwIfError(
    error,
    'failed to list teams paginated',
    'Failed to retrieve teams list'
  );

  return {
    teams: (data ?? []) as unknown as Team[],
    ...paginationMeta(count ?? 0, page, limit),
  };
}

export const createTeam = service.createTeam;
export const updateTeam = service.updateTeam;
export const softDeleteTeam = service.softDeleteTeam;
export const restoreTeam = service.restoreTeam;
export const hardDeleteTeam = service.hardDeleteTeam;

export type {
  Team,
  GetTeamsPaginatedResponse,
  CreateTeamInput,
  UpdateTeamInput,
} from './teams.service.base';
