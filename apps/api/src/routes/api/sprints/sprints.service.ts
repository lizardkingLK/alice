import type {
  CreateSprintBody,
  SprintResponse,
  UpdateSprintBody,
} from './sprints.schemas';
import {
  sprintsRepository,
  type SprintRowWithProject,
  type SprintRow,
} from './sprints.repository';

const dbStatusToResponseMap: Record<
  'planned' | 'active' | 'closed',
  'Not Started' | 'Ongoing' | 'Completed' | 'Archived'
> = {
  planned: 'Not Started',
  active: 'Ongoing',
  closed: 'Completed',
};

function toSprintResponse(row: SprintRowWithProject): SprintResponse {
  return {
    id: row.id,
    name: row.name,
    goal: row.goal,
    status: dbStatusToResponseMap[row.status] || 'Not Started',
    startDate: row.start_date,
    endDate: row.end_date,
    createdBy: row.created_by ?? '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    project: row.project
      ? {
          id: row.project.id,
          name: row.project.name,
          key: row.project.key,
        }
      : null,
  };
}

export class SprintsService {
  async createSprint(
    userId: string,
    input: CreateSprintBody
  ): Promise<SprintResponse> {
    const goal =
      input.goal === undefined || input.goal === '' ? null : input.goal;

    const row = await sprintsRepository.create({
      name: input.name,
      goal,
      projectId: input.projectId,
      startDate: input.startDate,
      endDate: input.endDate,
      createdBy: userId,
    });

    return toSprintResponse(row);
  }

  async listSprints(userId: string): Promise<SprintResponse[]> {
    const rows = await sprintsRepository.listByUser(userId);
    return rows.map(toSprintResponse);
  }

  async updateSprintStatus(
    userId: string,
    sprintId: string,
    status: SprintRow['status']
  ): Promise<SprintResponse> {
    const row = await sprintsRepository.updateStatus(userId, sprintId, status);
    return toSprintResponse(row);
  }

  async getSprint(
    userId: string,
    sprintId: string
  ): Promise<SprintResponse | null> {
    const row = await sprintsRepository.findById(userId, sprintId);
    return row ? toSprintResponse(row) : null;
  }

  async updateSprint(
    userId: string,
    sprintId: string,
    input: UpdateSprintBody
  ): Promise<SprintResponse> {
    const goal =
      input.goal === undefined || input.goal === '' ? null : input.goal;

    const row = await sprintsRepository.update(userId, sprintId, {
      name: input.name,
      goal,
      startDate: input.startDate,
      endDate: input.endDate,
      projectId: input.projectId,
    });

    return toSprintResponse(row);
  }
}

export const sprintsService = new SprintsService();
