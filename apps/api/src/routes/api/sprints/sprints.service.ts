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
import { requireUserWithRole } from '../../../lib/auth-helpers';
import { supabase } from '../../../lib/supabase';


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

  async listSprints(
    userId: string,
    tab: 'active' | 'archived' = 'active',
    page: number = 1,
    limit: number = 5,
    search?: string
  ): Promise<{
    sprints: SprintResponse[];
    pagination: {
      page: number;
      limit: number;
      totalCount: number;
      totalPages: number;
    };
  }> {
    const { sprints, totalCount } = await sprintsRepository.listByUser(
      userId,
      tab,
      page,
      limit,
      search
    );
    const totalPages = Math.ceil(totalCount / limit);
    return {
      sprints: sprints.map(toSprintResponse),
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: totalPages === 0 ? 1 : totalPages,
      },
    };
  }

  async updateSprintStatus(
    userId: string,
    sprintId: string,
    status: SprintRow['status']
  ): Promise<SprintResponse> {
    await requireManagerOrAdmin(userId);

    if (status === 'active' || status === 'closed') {
      const { data: workItems, error: itemsError } = await supabase
        .from('work_items')
        .select('id, status')
        .eq('sprint_id', sprintId);

      if (itemsError) {
        console.error('Failed to query work items for status update check:', itemsError.message);
        throw new Error('Failed to validate sprint work items');
      }

      if (status === 'active') {
        if (!workItems || workItems.length === 0) {
          throw new Error('Cannot start a sprint without work items');
        }
      }

      if (status === 'closed') {
        const incomplete = workItems?.filter((item) => item.status !== 'Done') ?? [];
        if (incomplete.length > 0) {
          throw new Error('Cannot complete sprint. All work items in the sprint must be completed (Done).');
        }
      }
    }

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
    await requireManagerOrAdmin(userId);
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
