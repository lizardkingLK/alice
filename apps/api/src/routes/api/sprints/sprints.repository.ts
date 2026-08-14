import {
  projectRelationSelect,
  type Database,
  type SprintRowWithProject,
  type Tables,
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
      .neq('status', 'Done');

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
