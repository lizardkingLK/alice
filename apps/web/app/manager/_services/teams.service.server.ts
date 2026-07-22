import { apiFetch } from '@/lib/api/api-client.server';
import { createClient } from '@/lib/supabase/server';
import { pageRange, paginationMeta } from '@/lib/db/pagination';
import { applyListSearch, throwIfError } from '@/lib/db/query';
import { createTeamsService } from './teams.service.base';
import type { GetTeamsPaginatedResponse, Team } from './teams.service.base';

const service = createTeamsService(apiFetch);

const TEAM_SELECT =
  '*, manager:users!teams_manager_id_fkey(id, name, email), members:team_members(*)';

/**
 * Reads query Supabase directly from the RSC layer to skip the `web → api`
 * hop. Mutations still go through the API.
 */

export async function getTeamList(): Promise<Team[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('teams')
    .select(TEAM_SELECT)
    .order('created_at', { ascending: false });

  throwIfError(error, 'failed to list teams', 'Failed to retrieve teams list');

  return (data ?? []) as unknown as Team[];
}

export async function getTeamListPaginated(
  page: number,
  limit: number,
  status?: 'active' | 'inactive' | 'archived',
  search?: string
): Promise<GetTeamsPaginatedResponse> {
  const supabase = await createClient();
  const { from, to } = pageRange(page, limit);

  let query = supabase.from('teams').select(TEAM_SELECT, { count: 'exact' });

  if (status) {
    query = query.eq('status', status);
  }

  query = applyListSearch(query, search, ['name', 'description', 'tech_stack']);

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(from, to);

  throwIfError(error, 'failed to list teams paginated', 'Failed to list teams');

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
