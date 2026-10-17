import { apiFetch } from '@/lib/api/api-fetch.reads.use.server';
import { shouldReadViaApi } from '@/lib/data-retrieval.server';
import { listTeamsPaginatedFromApi } from './teams.reads.api.server';
import {
  getActiveProjectTeamsFromSupabase,
  listTeamsPaginatedFromSupabase,
} from './teams.reads.supabase.server';
import {
  createTeamsService,
  type GetTeamsPaginatedResponse,
  type Team,
} from './teams.mutations.shared';

const service = createTeamsService(apiFetch);

/**
 * Public server read facade — picks supabase-js (default) or Express GET
 * based on `DATA_READS_VIA_API`. Mutations still go through the API.
 */
export async function getTeamListPaginated(
  page: number,
  limit: number,
  status?: 'active' | 'inactive' | 'archived' | 'deleted',
  search?: string,
  projectId?: string
): Promise<GetTeamsPaginatedResponse> {
  if (shouldReadViaApi('teams')) {
    return listTeamsPaginatedFromApi(page, limit, status, search, projectId);
  }

  return listTeamsPaginatedFromSupabase(page, limit, status, search, projectId);
}

/**
 * Unpaginated active project teams for policy selectors.
 * Supabase-only: `GET /api/teams` is paginated (max 100) and has no
 * name-ordered unpaginated contract.
 */
export async function getActiveProjectTeams(
  projectId: string
): Promise<Team[]> {
  return getActiveProjectTeamsFromSupabase(projectId);
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
