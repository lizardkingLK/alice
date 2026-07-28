import { apiFetch } from '@/lib/api/api-client';
import { createTeamsService } from './teams.service.base';

const service = createTeamsService(apiFetch);

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
