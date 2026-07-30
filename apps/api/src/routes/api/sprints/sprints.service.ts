import type {
  CreateSprintBody,
  SprintResponse,
  UpdateSprintBody,
} from '@/routes/api/sprints/sprints.schemas';
import {
  sprintsRepository,
  type SprintRowWithProject,
  type SprintRow,
} from '@/routes/api/sprints/sprints.repository';
import { requireUserWithRole } from '@/lib/auth-helpers';

async function requireManagerOrAdmin(actorId: string) {
  return await requireUserWithRole(
    actorId,
    ['admin', 'manager'],
    'Unauthorized. Only admins and managers can perform this action on sprints.'
  );
}

const dbStatusToResponseMap: Record<
  'planned' | 'active' | 'closed' | 'archived',
  'Not Started' | 'Ongoing' | 'Completed' | 'Archived'
> = {
  planned: 'Not Started',
  active: 'Ongoing',
  closed: 'Completed',
  archived: 'Archived',
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
    updatedBy: row.updated_by,
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
    await requireManagerOrAdmin(userId);
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


  async updateSprintStatus(
    userId: string,
    sprintId: string,
    status: SprintRow['status']
  ): Promise<SprintResponse> {
    await requireManagerOrAdmin(userId);

    if (status === 'active') {
      const count = await sprintsRepository.getWorkItemCount(sprintId);
      if (count === 0) {
        throw new Error(
          "If sprint haven't any work items cannot start the sprint."
        );
      }
    }

    if (status === 'closed') {
      const count = await sprintsRepository.getWorkItemCount(sprintId);
      if (count === 0) {
        throw new Error(
          "If sprint haven't any work items cannot complete the sprint."
        );
      }

      const incompleteCount =
        await sprintsRepository.getIncompleteWorkItemCount(sprintId);
      if (incompleteCount > 0) {
        throw new Error(
          "Can't complete the sprint all the work items are not done."
        );
      }
    }

    if (status === 'archived') {
      const currentSprint = await sprintsRepository.findById(sprintId);
      if (!currentSprint) {
        throw new Error('Sprint not found');
      }
      if (
        currentSprint.status === 'planned' ||
        currentSprint.status === 'active'
      ) {
        throw new Error('Cannot archive ongoing or not started sprints.');
      }
    }

    const row = await sprintsRepository.updateStatus(userId, sprintId, status);
    return toSprintResponse(row);
  }


  async updateSprint(
    userId: string,
    sprintId: string,
    input: UpdateSprintBody
  ): Promise<SprintResponse> {
    await requireManagerOrAdmin(userId);
    const goal =
      input.goal === undefined || input.goal === '' ? null : input.goal;

    const currentSprint = await sprintsRepository.findById(sprintId);
    if (!currentSprint) {
      throw new Error('Sprint not found');
    }
    if (currentSprint.status === 'archived') {
      throw new Error('Cannot edit an archived sprint');
    }

    if (input.projectId !== currentSprint.project_id) {
      const count = await sprintsRepository.getWorkItemCount(sprintId);
      if (count > 0) {
        throw new Error('Cannot change the project of a sprint that has work items.');
      }
    }

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
