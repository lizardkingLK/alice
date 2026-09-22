import { apiFetch } from '@/lib/api/api-fetch.reads.use.server';
import { createClient } from '@/lib/supabase/server';
import {
  applyListSearch,
  runPaginatedSelect,
  throwIfError,
} from '@/lib/db/query';
import { createTeamsService } from './teams.mutations.shared';
import type { GetTeamsPaginatedResponse, Team } from './teams.mutations.shared';

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

  const { rows: teams, ...meta } = await runPaginatedSelect<Team>(
    query,
    page,
    limit,
    {
      orderBy: 'created_at',
      logLabel: 'failed to list teams paginated',
      errorMessage: 'Failed to retrieve teams list',
    }
  );

  return { teams, ...meta };
}

/** Unpaginated active project teams for policy selectors. */
export async function getActiveProjectTeams(
  projectId: string
): Promise<Team[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('teams')
    .select(TEAM_LIST_SELECT)
    .eq('project_id', projectId)
    .eq('status', 'active')
    .order('name', { ascending: true });

  throwIfError(
    error,
    'failed to list active project teams',
    'Failed to retrieve active project teams'
  );

  return (data ?? []) as unknown as Team[];
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
} from './teams.mutations.shared';
