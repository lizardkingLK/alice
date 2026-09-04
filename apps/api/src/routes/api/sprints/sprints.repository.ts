import {
  projectRelationSelect,
  WorkItemStatusEnum,
  type Database,
  type SprintRowWithProject,
  type Tables,
  sprintListSelect,
  sprintDetailSelect,
  type SprintDetailRow,
  type SprintPrismaListFilters,
  paginationMeta,
} from '@repo/types';
import { prisma } from '../../../lib/prisma';
import {
  prismaAuditCreateWithoutStatus,
  prismaAuditUpdate,
  prismaLockTimestamp,
  prismaOptionalDate,
} from '../../../lib/prisma-audit';
import { resolveOptimisticPrismaUpdate } from '../../../lib/optimistic-lock';
import type { SupabaseClient } from '@supabase/supabase-js';
import { listAccessibleProjectIds } from '../../../lib/project-access';
import { SprintAccessError } from './sprints.errors';
import {
  buildSprintPrismaListWhere,
  sprintListPageSlice,
  type SprintPaginatedList,
} from './sprints.prisma-query';

export type SprintRow = Tables<'sprints'>;

const SPRINT_WITH_PROJECT = `*, ${projectRelationSelect()}`;

export type CreateSprintRecord = {
  name: string;
  goal: string | null;
  startDate: string;
  endDate: string;
  createdBy: string;
  projectId: string;
};

export class SprintsRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async create(input: CreateSprintRecord): Promise<SprintRowWithProject> {
    const created = await prisma.sprints.create({
      data: {
        name: input.name,
        goal: input.goal,
        start_date: prismaOptionalDate(input.startDate)!,
        end_date: prismaOptionalDate(input.endDate)!,
        project_id: input.projectId,
        ...prismaAuditCreateWithoutStatus(input.createdBy),
      },
    });

    const row = await this.findById(created.id);
    if (!row) {
      throw new Error('Failed to create sprint');
    }
    return row;
  }

  async updateStatus(
    userId: string,
    sprintId: string,
    status: SprintRow['status'],
    expectedUpdatedAt: string
  ): Promise<SprintRowWithProject> {
    const { count } = await prisma.sprints.updateMany({
      where: {
        id: sprintId,
        updated_at: prismaLockTimestamp(expectedUpdatedAt),
      },
      data: {
        status,
        ...prismaAuditUpdate(userId),
      },
    });

    return resolveOptimisticPrismaUpdate({
      count,
      fetchUpdated: () => this.findById(sprintId),
      fetchCurrent: () => this.findById(sprintId),
      notFoundMessage: 'Sprint not found',
    });
  }

  async getWorkItemCount(sprintId: string): Promise<number> {
    const { count, error } = await this.db
      .from('work_items')
      .select('*', { count: 'exact', head: true })
      .eq('sprint_id', sprintId);

    if (error) {
      console.error('error. failed to get work item count:', error.message);
      throw new Error('Failed to get work item count');
    }

    return count ?? 0;
  }

  async getIncompleteWorkItemCount(sprintId: string): Promise<number> {
    const { count, error } = await this.db
      .from('work_items')
      .select('*', { count: 'exact', head: true })
      .eq('sprint_id', sprintId)
      .neq('status', WorkItemStatusEnum.Done);

    if (error) {
      console.error(
        'error. failed to get incomplete work item count:',
        error.message
      );
      throw new Error('Failed to get incomplete work item count');
    }

    return count ?? 0;
  }

  async findById(sprintId: string): Promise<SprintRowWithProject | null> {
    const { data, error } = await this.db
      .from('sprints')
      .select(SPRINT_WITH_PROJECT)
      .eq('id', sprintId)
      .maybeSingle();

    if (error) {
      console.error('error. failed to find sprint:', error.message);
      throw new Error('Failed to find sprint');
    }

    return data as unknown as SprintRowWithProject | null;
  }

  async update(
    userId: string,
    sprintId: string,
    input: {
      name: string;
      goal: string | null;
      startDate: string;
      endDate: string;
      projectId: string;
    },
    expectedUpdatedAt: string
  ): Promise<SprintRowWithProject> {
    const { count } = await prisma.sprints.updateMany({
      where: {
        id: sprintId,
        updated_at: prismaLockTimestamp(expectedUpdatedAt),
      },
      data: {
        name: input.name,
        goal: input.goal,
        start_date: prismaOptionalDate(input.startDate)!,
        end_date: prismaOptionalDate(input.endDate)!,
        project_id: input.projectId,
        ...prismaAuditUpdate(userId),
      },
    });

    return resolveOptimisticPrismaUpdate({
      count,
      fetchUpdated: () => this.findById(sprintId),
      fetchCurrent: () => this.findById(sprintId),
      notFoundMessage: 'Sprint not found',
    });
  }

  async listAccessibleProjectIds(actorId: string): Promise<string[]> {
    return listAccessibleProjectIds(this.db, actorId);
  }

  async assertCanAccessProject(
    actorId: string,
    projectId: string
  ): Promise<void> {
    const accessible = await this.listAccessibleProjectIds(actorId);
    if (!accessible.includes(projectId)) {
      throw new SprintAccessError();
    }
  }

  async requireProjectMember(
    sprintId: string,
    actorId: string
  ): Promise<{ projectId: string }> {
    const { data: sprint, error: sprintError } = await this.db
      .from('sprints')
      .select('project_id')
      .eq('id', sprintId)
      .maybeSingle();

    if (sprintError) {
      console.error(
        'error. failed to load sprint for project access:',
        sprintError.message
      );
      throw new Error('Failed to authorize sprint access');
    }

    if (!sprint) {
      throw new Error('Sprint not found');
    }

    await this.assertCanAccessProject(actorId, sprint.project_id);
    return { projectId: sprint.project_id };
  }

  async listPaginated(input: {
    filters?: SprintPrismaListFilters;
    search?: string;
    page: number;
    limit: number;
  }): Promise<SprintPaginatedList> {
    const where = buildSprintPrismaListWhere(input.filters, input.search);
    const { skip, take } = sprintListPageSlice(input.page, input.limit);

    try {
      const [sprints, totalCount] = await Promise.all([
        prisma.sprints.findMany({
          where,
          select: sprintListSelect,
          orderBy: { start_date: 'asc' },
          skip,
          take,
        }),
        prisma.sprints.count({ where }),
      ]);

      return {
        sprints,
        ...paginationMeta(totalCount, input.page, input.limit),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('error. failed to list sprints:', message);
      throw new Error('Failed to list sprints');
    }
  }

  async getDetailById(sprintId: string): Promise<SprintDetailRow | null> {
    try {
      return await prisma.sprints.findUnique({
        where: { id: sprintId },
        select: sprintDetailSelect,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('error. failed to get sprint detail:', message);
      throw new Error('Failed to get sprint');
    }
  }
}

export type BurndownWorkItem = {
  id: string;
  story_points: number | null;
  done_at: string | null;
};

export class SprintBurndownRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async getSprintById(sprintId: string): Promise<SprintRow | null> {
    const { data, error } = await this.db
      .from('sprints')
      .select('id, name, start_date, end_date, status, project_id')
      .eq('id', sprintId)
      .maybeSingle();

    if (error) {
      console.error(
        'error. failed to fetch sprint for burndown:',
        error.message
      );
      throw new Error('Failed to fetch sprint');
    }

    return data as SprintRow | null;
  }

  async getWorkItemsForBurndown(sprintId: string): Promise<BurndownWorkItem[]> {
    const { data, error } = await this.db
      .from('work_items')
      .select('id, story_points, done_at')
      .eq('sprint_id', sprintId);

    if (error) {
      console.error(
        'error. failed to fetch work items for burndown:',
        error.message
      );
      throw new Error('Failed to fetch work items for burndown');
    }

    return (data ?? []) as BurndownWorkItem[];
  }

  async getWorkLogsForWorkItems(
    workItemIds: readonly string[]
  ): Promise<Array<{ logged_at: string; logged_hours: number }>> {
    if (workItemIds.length === 0) {
      return [];
    }

    // New table isn't in generated `@repo/types` yet.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = this.db as unknown as SupabaseClient<any>;

    const { data, error } = await db
      .from('work_item_worklogs')
      .select('logged_at, logged_hours')
      .in('work_item_id', workItemIds);

    if (error) {
      console.error(
        'error. failed to fetch work logs for burndown:',
        error.message
      );
      throw new Error('Failed to fetch work logs for burndown');
    }

    return (data ?? []) as Array<{ logged_at: string; logged_hours: number }>;
  }
}
