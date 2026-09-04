import {
  WorkItemStatusEnum,
  type Database,
  type DeleteSprintWorkItemsAction,
  DeleteSprintWorkItemsActionEnum,
  type SprintRowWithProject,
  type Tables,
  sprintListSelect,
  sprintDetailSelect,
  type SprintDetailRow,
  type SprintPrismaListFilters,
  paginationMeta,
} from '@repo/types';
import { prisma } from '../../../lib/prisma';
import { env } from '../../../config/env';
import { removeStorageObjects } from '../../../lib/file-helpers';
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
    try {
      const row = await prisma.sprints.findUnique({
        where: { id: sprintId },
        select: sprintListSelect,
      });

      if (!row) {
        return null;
      }

      return {
        ...row,
        start_date: row.start_date.toISOString().split('T')[0]!,
        end_date: row.end_date.toISOString().split('T')[0]!,
        created_at: row.created_at.toISOString(),
        updated_at: row.updated_at.toISOString(),
      } as unknown as SprintRowWithProject;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('error. failed to find sprint:', message);
      throw new Error('Failed to find sprint');
    }
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

  async listAccessibleProjectIds(actorId: string): Promise<'all' | string[]> {
    return listAccessibleProjectIds(this.db, actorId);
  }

  async assertCanAccessProject(
    actorId: string,
    projectId: string
  ): Promise<void> {
    const accessible = await this.listAccessibleProjectIds(actorId);
    if (accessible === 'all') {
      return;
    }
    if (!accessible.includes(projectId)) {
      throw new SprintAccessError();
    }
  }

  async requireProjectMember(
    sprintId: string,
    actorId: string
  ): Promise<{ projectId: string }> {
    let sprint;
    try {
      sprint = await prisma.sprints.findUnique({
        where: { id: sprintId },
        select: { project_id: true },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(
        'error. failed to load sprint for project access:',
        message
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

  private async cleanupItemAttachments(
    itemIds: string[]
  ): Promise<string[] | null> {
    const attachments = await prisma.attachments.findMany({
      where: { work_item_id: { in: itemIds } },
      select: { storage_path: true },
    });

    const paths = attachments
      .map((a) => a.storage_path)
      .filter((p): p is string => Boolean(p));

    if (paths.length === 0) {
      return null;
    }

    try {
      await removeStorageObjects(env.STORAGE_BUCKET_ATTACHMENTS, paths);
      return paths;
    } catch (storageError) {
      console.error(
        'error. failed to remove attachment storage objects on sprint delete:',
        storageError instanceof Error ? storageError.message : storageError
      );
      return null;
    }
  }

  private async deleteSprintWorkItemsAndAttachments(
    sprintId: string
  ): Promise<{ deletedItemCount: number } | null> {
    const items = await prisma.work_items.findMany({
      where: { sprint_id: sprintId },
      select: { id: true },
    });
    const itemIds = items.map((i) => i.id);

    if (itemIds.length === 0) {
      return null;
    }

    await this.cleanupItemAttachments(itemIds);

    const result = await prisma.work_items.deleteMany({
      where: { sprint_id: sprintId },
    });

    return { deletedItemCount: result.count };
  }

  async deleteSprint(
    sprintId: string,
    workItemsAction: DeleteSprintWorkItemsAction
  ): Promise<void> {
    if (workItemsAction === DeleteSprintWorkItemsActionEnum.DeleteContent) {
      await this.deleteSprintWorkItemsAndAttachments(sprintId);
    } else {
      await prisma.work_items.updateMany({
        where: { sprint_id: sprintId },
        data: { sprint_id: null },
      });
    }

    await prisma.sprints.deleteMany({
      where: { id: sprintId },
    });
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
    try {
      const sprint = await prisma.sprints.findUnique({
        where: { id: sprintId },
        select: {
          id: true,
          name: true,
          start_date: true,
          end_date: true,
          status: true,
          project_id: true,
        },
      });

      if (!sprint) {
        return null;
      }

      return {
        ...sprint,
        start_date: sprint.start_date.toISOString().split('T')[0]!,
        end_date: sprint.end_date.toISOString().split('T')[0]!,
      } as unknown as SprintRow;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('error. failed to fetch sprint for burndown:', message);
      throw new Error('Failed to fetch sprint');
    }
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
