import type {
  CreateSprintBody,
  SprintResponse,
  UpdateSprintBody,
} from './sprints.schemas';
import {
  sprintsRepository,
  sprintBurndownRepository,
  type SprintRowWithProject,
  type SprintRow,
  type BurndownWorkItem,
} from './sprints.repository';
import { requireUserWithRole } from '../../../lib/auth-helpers';

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
        throw new Error(
          'Cannot change the project of a sprint that has work items.'
        );
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

export type BurndownPoint = {
  date: string;
  remaining: number | null;
  ideal: number;
};

export type BurndownResponse = {
  sprint: {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    status: string;
  };
  estimatedTotal: number;
  series: BurndownPoint[];
};

function computeBurndown(
  sprint: { start_date: string; end_date: string; status: string },
  items: BurndownWorkItem[],
  workLogs: Array<{ logged_at: string; logged_hours: number }>
): { estimatedTotal: number; series: BurndownPoint[] } {
  const start = new Date(sprint.start_date);
  const end = new Date(sprint.end_date);
  const todayStr = new Date().toISOString().slice(0, 10);

  const estimatedTotal = items.reduce(
    (sum, item) => sum + (item.story_points ?? 0),
    0
  );

  const durationDays = (end.getTime() - start.getTime()) / 86_400_000;

  const series: BurndownPoint[] = [];
  const hasWorkLogs = workLogs.length > 0;

  for (let cur = new Date(start); cur <= end; cur.setDate(cur.getDate() + 1)) {
    const dayLabel = cur.toISOString().slice(0, 10);

    const elapsed = (cur.getTime() - start.getTime()) / 86_400_000;
    const ideal =
      durationDays === 0
        ? 0
        : Math.max(0, estimatedTotal * (1 - elapsed / durationDays));

    const isPast = sprint.status === 'closed' ? true : dayLabel <= todayStr;

    let remaining: number | null = null;
    if (isPast) {
      if (hasWorkLogs) {
        const spent = workLogs.reduce((sum, log) => {
          const loggedDay = log.logged_at.slice(0, 10);
          return loggedDay <= dayLabel ? sum + log.logged_hours : sum;
        }, 0);

        // Simple mapping: treat 1 logged hour as 1 spent point.
        remaining = Math.max(0, estimatedTotal - spent);
      } else {
        remaining = items.reduce((sum, item) => {
          const doneBefore =
            item.done_at !== null && item.done_at.slice(0, 10) <= dayLabel;
          return doneBefore ? sum : sum + (item.story_points ?? 0);
        }, 0);
      }
    }

    series.push({
      date: dayLabel,
      remaining,
      ideal: Math.round(ideal * 100) / 100,
    });
  }

  return { estimatedTotal, series };
}

export class SprintBurndownService {
  async getBurndown(sprintId: string): Promise<BurndownResponse | null> {
    const sprint = await sprintBurndownRepository.getSprintById(sprintId);
    if (!sprint) {
      return null;
    }

    const items =
      await sprintBurndownRepository.getWorkItemsForBurndown(sprintId);
    const workItemIds = items.map((i) => i.id);
    const workLogs =
      await sprintBurndownRepository.getWorkLogsForWorkItems(workItemIds);
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

export const sprintBurndownService = new SprintBurndownService();
