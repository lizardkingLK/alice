import { requireUserWithRole } from '../../../lib/auth-helpers';
import {
  RecordStatusEnum,
  UserRoleEnum,
  type ListTeamsQuery,
  type TeamListRow,
} from '@repo/types';
import { type TeamRow, type TeamsRepository } from './teams.repository';

async function requireTeamManager(actorId: string) {
  return await requireUserWithRole(
    actorId,
    [UserRoleEnum.admin, UserRoleEnum.manager],
    'Unauthorized. Only admins and managers can manage teams.'
  );
}

async function requireAdmin(actorId: string) {
  return await requireUserWithRole(
    actorId,
    [UserRoleEnum.admin],
    'Unauthorized. Only administrators can permanently delete teams.'
  );
}

export type CreateTeamInput = Omit<
  TeamRow,
  'id' | 'created_at' | 'updated_at' | 'created_by' | 'updated_by'
> & {
  member_ids?: string[];
  members?: {
    user_id: string;
    capacity?: number | null;
    allocation?: number | null;
  }[];
};

export type UpdateTeamInput = Partial<CreateTeamInput>;

export class TeamsService {
  constructor(private readonly teamsRepository: TeamsRepository) {}

  async listTeamsPaginated(
    query: ListTeamsQuery,
    _actorId: string
  ): Promise<{
    teams: TeamListRow[];
    totalCount: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    return await this.teamsRepository.listPaginated({
      projectId: query.projectId,
      status: query.status,
      search: query.search,
      page: query.page,
      limit: query.limit,
    });
  }

  async getTeamDetail(
    teamId: string,
    _actorId: string
  ): Promise<TeamListRow | null> {
    return await this.teamsRepository.getDetailById(teamId);
  }

  async createTeam(actorId: string, input: CreateTeamInput): Promise<TeamRow> {
    await requireTeamManager(actorId);

    const duplicate = await this.teamsRepository.findByName(
      input.name,
      input.project_id ?? null
    );
    if (duplicate) {
      throw new Error(`A team with the name "${input.name}" already exists.`);
    }

    return await this.teamsRepository.create(input, actorId);
  }

  async updateTeam(
    actorId: string,
    teamId: string,
    input: UpdateTeamInput,
    expectedUpdatedAt: string
  ): Promise<TeamRow> {
    await requireTeamManager(actorId);

    if (input.name !== undefined || input.project_id !== undefined) {
      let targetProjectId = input.project_id;
      let targetName = input.name;

      if (targetProjectId === undefined || targetName === undefined) {
        const currentTeam = await this.teamsRepository.findById(teamId);
        if (targetProjectId === undefined) {
          targetProjectId = currentTeam?.project_id ?? null;
        }
        if (targetName === undefined) {
          targetName = currentTeam?.name;
        }
      }

      if (targetName) {
        const duplicate = await this.teamsRepository.findByName(
          targetName,
          targetProjectId ?? null,
          teamId
        );
        if (duplicate) {
          throw new Error(
            `Another team with the name "${targetName}" already exists.`
          );
        }
      }
    }

    return await this.teamsRepository.update(
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

    return await this.teamsRepository.update(
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

    return await this.teamsRepository.update(
      teamId,
      {
        status: RecordStatusEnum.active,
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
    await this.teamsRepository.updateMember(
      teamId,
      userId,
      patch,
      actorId,
      expectedUpdatedAt
    );
  }

  async hardDeleteTeam(actorId: string, teamId: string): Promise<void> {
    await requireAdmin(actorId);

    await this.teamsRepository.delete(teamId);
  }
}
