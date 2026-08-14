import {
  computeBurndown,
  mapSprintRowToResponse,
  SprintStatusEnum,
  UserRoleEnum,
  type SprintBurndownPayload,
  type SprintResponse,
} from '@repo/types';
import type { CreateSprintBody, UpdateSprintBody } from './sprints.schemas';
import type {
  SprintsRepository,
  SprintBurndownRepository,
  SprintRow,
} from './sprints.repository';
import { requireUserWithRole } from '../../../lib/auth-helpers';

export type {
  BurndownPoint,
  SprintBurndownPayload as BurndownResponse,
} from '@repo/types';

async function requireManagerOrAdmin(actorId: string) {
  return await requireUserWithRole(
    actorId,
    [UserRoleEnum.admin, UserRoleEnum.manager],
    'Unauthorized. Only admins and managers can perform this action on sprints.'
  );
}

export class SprintsService {
  constructor(private readonly sprints: SprintsRepository) {}

  async createSprint(
    userId: string,
    input: CreateSprintBody
  ): Promise<SprintResponse> {
    await requireManagerOrAdmin(userId);
    const goal =
      input.goal === undefined || input.goal === '' ? null : input.goal;

    const row = await this.sprints.create({
      name: input.name,
      goal,
      projectId: input.projectId,
      startDate: input.startDate,
      endDate: input.endDate,
      createdBy: userId,
    });

    return mapSprintRowToResponse(row);
  }

  async updateSprintStatus(
    userId: string,
    sprintId: string,
    status: SprintRow['status'],
    expectedUpdatedAt: string
  ): Promise<SprintResponse> {
    await requireManagerOrAdmin(userId);

    if (status === SprintStatusEnum.Active) {
      const count = await this.sprints.getWorkItemCount(sprintId);
      if (count === 0) {
        throw new Error(
          "If sprint haven't any work items cannot start the sprint."
        );
      }
    }

    if (status === SprintStatusEnum.Closed) {
      const count = await this.sprints.getWorkItemCount(sprintId);
      if (count === 0) {
        throw new Error(
          "If sprint haven't any work items cannot complete the sprint."
        );
      }

      const incompleteCount =
        await this.sprints.getIncompleteWorkItemCount(sprintId);
      if (incompleteCount > 0) {
        throw new Error(
          "Can't complete the sprint all the work items are not done."
        );
      }
    }

    if (status === SprintStatusEnum.Archived) {
      const currentSprint = await this.sprints.findById(sprintId);
      if (!currentSprint) {
        throw new Error('Sprint not found');
      }
      if (
        currentSprint.status === SprintStatusEnum.Planned ||
        currentSprint.status === SprintStatusEnum.Active
      ) {
        throw new Error('Cannot archive active or planned sprints.');
      }
    }

    const row = await this.sprints.updateStatus(
      userId,
      sprintId,
      status,
      expectedUpdatedAt
    );
    return mapSprintRowToResponse(row);
  }

  async updateSprint(
    userId: string,
    sprintId: string,
    input: UpdateSprintBody
  ): Promise<SprintResponse> {
    await requireManagerOrAdmin(userId);
    const goal =
      input.goal === undefined || input.goal === '' ? null : input.goal;

    const currentSprint = await this.sprints.findById(sprintId);
    if (!currentSprint) {
      throw new Error('Sprint not found');
    }
    if (currentSprint.status === SprintStatusEnum.Archived) {
      throw new Error('Cannot edit an archived sprint');
    }

    if (input.projectId !== currentSprint.project_id) {
      const count = await this.sprints.getWorkItemCount(sprintId);
      if (count > 0) {
        throw new Error(
          'Cannot change the project of a sprint that has work items.'
        );
      }
    }

    const row = await this.sprints.update(
      userId,
      sprintId,
      {
        name: input.name,
        goal,
        startDate: input.startDate,
        endDate: input.endDate,
        projectId: input.projectId,
      },
      input.expectedUpdatedAt
    );

    return mapSprintRowToResponse(row);
  }
}

export class SprintBurndownService {
  constructor(private readonly burndownRepo: SprintBurndownRepository) {}

  async getBurndown(sprintId: string): Promise<SprintBurndownPayload | null> {
    const sprint = await this.burndownRepo.getSprintById(sprintId);
    if (!sprint) {
      return null;
    }

    const items = await this.burndownRepo.getWorkItemsForBurndown(sprintId);
    const workItemIds = items.map((i) => i.id);
    const workLogs =
      await this.burndownRepo.getWorkLogsForWorkItems(workItemIds);
    const { estimatedTotal, series } = computeBurndown(sprint, items, workLogs);

    return {
      sprint: {
        id: sprint.id,
        name: sprint.name,
        startDate: sprint.start_date,
        endDate: sprint.end_date,
        status: sprint.status,
      },
      estimatedTotal,
      series,
    };
  }
}
