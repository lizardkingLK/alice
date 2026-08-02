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
> & {
  member_ids?: string[];
};

export type UpdateTeamInput = Partial<CreateTeamInput>;

export class TeamsService {
  async listTeams(): Promise<TeamRowWithManager[]>;
  async listTeams(
    page: number,
    limit: number,
    status?: 'active' | 'inactive' | 'archived' | 'deleted',
    search?: string,
    projectId?: string
  ): Promise<{ teams: TeamRowWithManager[]; totalCount: number }>;
  async listTeams(
    page?: number,
    limit?: number,
    status?: 'active' | 'inactive' | 'archived' | 'deleted',
    search?: string,
    projectId?: string
  ): Promise<
    { teams: TeamRowWithManager[]; totalCount: number } | TeamRowWithManager[]
  > {
    if (page !== undefined && limit !== undefined) {
      return await teamsRepository.listPaginated(
        page,
        limit,
        status,
        search,
        projectId
      );
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
    input: UpdateTeamInput,
    expectedUpdatedAt: string
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

    return await teamsRepository.update(
      teamId,
      input,
      actorId,
      expectedUpdatedAt
    );
  }

  async softDeleteTeam(
    actorId: string,
    teamId: string,
    expectedUpdatedAt: string
  ): Promise<TeamRow> {
    await requireTeamManager(actorId);

    return await teamsRepository.update(
      teamId,
      {
        status: 'archived',
      },
      actorId,
      expectedUpdatedAt
    );
  }

  async restoreTeam(
    actorId: string,
    teamId: string,
    expectedUpdatedAt: string
  ): Promise<TeamRow> {
    await requireTeamManager(actorId);

    return await teamsRepository.update(
      teamId,
      {
        status: 'active',
      },
      actorId,
      expectedUpdatedAt
    );
  }

  async updateTeamMember(
    teamId: string,
    userId: string,
    patch: { capacity?: number | null; allocation?: number | null },
    actorId: string,
    expectedUpdatedAt: string
  ): Promise<void> {
    await requireTeamManager(actorId);
    await teamsRepository.updateMember(
      teamId,
      userId,
      patch,
      actorId,
      expectedUpdatedAt
    );
  }

  async hardDeleteTeam(actorId: string, teamId: string): Promise<void> {
    await requireAdmin(actorId);

    await teamsRepository.delete(teamId);
  }
}

export const teamsService = new TeamsService();
