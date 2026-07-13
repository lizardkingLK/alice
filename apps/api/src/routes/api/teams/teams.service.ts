import { requireUserWithRole } from '../../../lib/auth-helpers';
import {
  teamsRepository,
  type TeamRow,
  type TeamRowWithManager,
} from './teams.repository';

async function requireTeamManager(actorId: string) {
  return await requireUserWithRole(
    actorId,
    ['admin', 'manager'],
    'Unauthorized. Only admins and managers can manage teams.'
  );
}

async function requireAdmin(actorId: string) {
  return await requireUserWithRole(
    actorId,
    ['admin'],
    'Unauthorized. Only administrators can permanently delete teams.'
  );
}

export type CreateTeamInput = Omit<
  TeamRow,
  'id' | 'created_at' | 'updated_at' | 'created_by' | 'updated_by'
>;

export type UpdateTeamInput = Partial<CreateTeamInput>;

export class TeamsService {
  async listTeams(): Promise<TeamRowWithManager[]>;
  async listTeams(
    page: number,
    limit: number,
    status?: 'active' | 'inactive' | 'archived' | 'deleted',
    search?: string
  ): Promise<{ teams: TeamRowWithManager[]; totalCount: number }>;
  async listTeams(
    page?: number,
    limit?: number,
    status?: 'active' | 'inactive' | 'archived' | 'deleted',
    search?: string
  ): Promise<
    { teams: TeamRowWithManager[]; totalCount: number } | TeamRowWithManager[]
  > {
    if (page !== undefined && limit !== undefined) {
      return await teamsRepository.listPaginated(page, limit, status, search);
    }
    return await teamsRepository.listAll();
  }

  async createTeam(actorId: string, input: CreateTeamInput): Promise<TeamRow> {
    await requireTeamManager(actorId);

    const duplicate = await teamsRepository.findByName(input.name);
    if (duplicate) {
      throw new Error(`A team with the name "${input.name}" already exists.`);
    }

    return await teamsRepository.create(input, actorId);
  }

  async updateTeam(
    actorId: string,
    teamId: string,
    input: UpdateTeamInput
  ): Promise<TeamRow> {
    await requireTeamManager(actorId);

    if (input.name) {
      const duplicate = await teamsRepository.findByName(input.name, teamId);
      if (duplicate) {
        throw new Error(
          `Another team with the name "${input.name}" already exists.`
        );
      }
    }

    return await teamsRepository.update(teamId, input, actorId);
  }

  async softDeleteTeam(actorId: string, teamId: string): Promise<TeamRow> {
    await requireTeamManager(actorId);

    return await teamsRepository.update(
      teamId,
      {
        status: 'archived',
      },
      actorId
    );
  }

  async restoreTeam(actorId: string, teamId: string): Promise<TeamRow> {
    await requireTeamManager(actorId);

    return await teamsRepository.update(
      teamId,
      {
        status: 'active',
      },
      actorId
    );
  }

  async hardDeleteTeam(actorId: string, teamId: string): Promise<void> {
    await requireAdmin(actorId);

    await teamsRepository.delete(teamId);
  }
}

export const teamsService = new TeamsService();
