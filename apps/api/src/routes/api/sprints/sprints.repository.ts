import { projectRelationSelect, type Database, type SprintRowWithProject, type Tables } from '@repo/types';
import { resolveOptimisticUpdate } from '../../../lib/optimistic-lock';
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
    const { data, error } = await this.db
      .from('sprints')
      .insert({
        name: input.name,
        goal: input.goal,
        start_date: input.startDate,
        end_date: input.endDate,
        created_by: input.createdBy,
        project_id: input.projectId,
        updated_at: new Date().toISOString(),
      })
      .select(SPRINT_WITH_PROJECT)
      .single();

    if (error) {
      console.error('error. failed to create sprint:', error.message);
      throw new Error('Failed to create sprint');
    }

    return data as unknown as SprintRowWithProject;
  }

  async updateStatus(
    userId: string,
    sprintId: string,
    status: SprintRow['status'],
    expectedUpdatedAt: string
  ): Promise<SprintRowWithProject> {
    const { data, error } = await this.db
      .from('sprints')
      .update({
        status,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sprintId)
      .eq('updated_at', expectedUpdatedAt)
      .select(SPRINT_WITH_PROJECT)
      .maybeSingle();

    return (await resolveOptimisticUpdate({
      data: data as unknown as SprintRowWithProject | null,
      error,
      fetchCurrent: () => this.findById(sprintId),
      notFoundMessage: 'Sprint not found',
    })) as SprintRowWithProject;
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
    const { data, error } = await this.db
      .from('sprints')
      .update({
        name: input.name,
        goal: input.goal,
        start_date: input.startDate,
        end_date: input.endDate,
        project_id: input.projectId,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sprintId)
      .eq('updated_at', expectedUpdatedAt)
      .select(SPRINT_WITH_PROJECT)
      .maybeSingle();

    return (await resolveOptimisticUpdate({
      data: data as unknown as SprintRowWithProject | null,
      error,
      fetchCurrent: () => this.findById(sprintId),
      notFoundMessage: 'Sprint not found',
    })) as SprintRowWithProject;
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
