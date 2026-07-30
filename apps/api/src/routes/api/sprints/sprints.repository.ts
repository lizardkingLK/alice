import { projectRelationSelect, type Tables } from '@repo/types';
import { supabase } from '@/lib/supabase';

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

  async findById(sprintId: string): Promise<SprintRowWithProject | null> {
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

export const sprintsRepository = new SprintsRepository();
