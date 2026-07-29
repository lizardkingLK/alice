import { projectRelationSelect, type Tables } from '@repo/types';
import { supabase } from '../../../lib/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

export type SprintRow = Tables<'sprints'>;

export type SprintRowWithProject = SprintRow & {
  project?: {
    id: string;
    name: string;
    key: string;
  } | null;
};

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
  async create(input: CreateSprintRecord): Promise<SprintRowWithProject> {
    const { data, error } = await supabase
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

  async listByUser(
    userId: string,
    tab: 'active' | 'archived' = 'active',
    page: number = 1,
    limit: number = 5,
    search?: string
  ): Promise<{
    sprints: SprintRowWithProject[];
    totalCount: number;
  }> {
    const from = (page - 1) * limit;
    const to = page * limit - 1;

    let query = supabase
      .from('sprints')
      .select(SPRINT_WITH_PROJECT, { count: 'exact' });

    if (tab === 'archived') {
      query = query.in('status', ['archived']);
    } else {
      query = query.in('status', ['planned', 'active', 'closed']);
    }

    if (search) {
      const sanitized = `%${search}%`;
      query = query.or(`name.ilike.${sanitized},goal.ilike.${sanitized}`);
    }

    const { data, error, count } = await query
      .order('start_date', { ascending: false })
      .range(from, to);

    if (error) {
      console.error('error. failed to list sprints:', error.message);
      throw new Error('Failed to list sprints');
    }

    return {
      sprints: (data as unknown as SprintRowWithProject[]) ?? [],
      totalCount: count ?? 0,
    };
  }

  async updateStatus(
    userId: string,
    sprintId: string,
    status: SprintRow['status']
  ): Promise<SprintRowWithProject> {
    const { data, error } = await supabase
      .from('sprints')
      .update({
        status,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sprintId)
      .select(SPRINT_WITH_PROJECT)
      .single();

    if (error) {
      console.error('error. failed to update sprint status:', error.message);
      throw new Error('Failed to update sprint status');
    }

    return data as unknown as SprintRowWithProject;
  }

  async getWorkItemCount(sprintId: string): Promise<number> {
    const { count, error } = await supabase
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
    const { count, error } = await supabase
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

  async findById(
    _userId: string,
    sprintId: string
  ): Promise<SprintRowWithProject | null> {
    const { data, error } = await supabase
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
    }
  ): Promise<SprintRowWithProject> {
    const { data, error } = await supabase
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
      .select(SPRINT_WITH_PROJECT)
      .single();

    if (error) {
      console.error('error. failed to update sprint:', error.message);
      throw new Error('Failed to update sprint');
    }

    return data as unknown as SprintRowWithProject;
  }
}

export type BurndownWorkItem = {
  id: string;
  story_points: number | null;
  done_at: string | null;
};

export const sprintsRepository = new SprintsRepository();

export class SprintBurndownRepository {
  async getSprintById(sprintId: string): Promise<SprintRow | null> {
    const { data, error } = await supabase
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
    const { data, error } = await supabase
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
    const db = supabase as unknown as SupabaseClient<any>;

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

export const sprintBurndownRepository = new SprintBurndownRepository();
