import { apiFetch } from '@/lib/api/api-fetch.mutations.use.client';
import { createTeamsService } from './teams.mutations.shared';

const service = createTeamsService(apiFetch);

export const createTeam = service.createTeam;
export const updateTeam = service.updateTeam;
export const forceUpdateTeam = service.forceUpdateTeam;
export const softDeleteTeam = service.softDeleteTeam;
export const restoreTeam = service.restoreTeam;
export const hardDeleteTeam = service.hardDeleteTeam;

export type {
  Team,
  GetTeamsPaginatedResponse,
  CreateTeamInput,
  UpdateTeamInput,
} from './teams.mutations.shared';
