import type { Tables } from '@repo/types';
import { supabase } from '../../../lib/supabase';

export type SprintRow = Tables<'sprints'>;

export type SprintRowWithProject = SprintRow & {
  project?: {
    id: string;
    name: string;
    key: string;
  } | null;
};

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
      .select('*, project:projects(id, name, key)')
      .single();

    if (error) {
      console.error('error. failed to create sprint:', error.message);
      throw new Error('Failed to create sprint');
    }

    return data as unknown as SprintRowWithProject;
  }

  async listByUser(userId: string): Promise<SprintRowWithProject[]> {
    const { data, error } = await supabase
      .from('sprints')
      .select('*, project:projects(id, name, key)')
      .eq('created_by', userId)
      .order('start_date', { ascending: false });

    if (error) {
      console.error('error. failed to list sprints:', error.message);
      throw new Error('Failed to list sprints');
    }

    return (data as unknown as SprintRowWithProject[]) ?? [];
  }

  async updateStatus(
    userId: string,
    sprintId: string,
    status: SprintRow['status']
  ): Promise<SprintRowWithProject> {
    const { data, error } = await supabase
      .from('sprints')
      .update({ status })
      .eq('id', sprintId)
      .eq('created_by', userId)
      .select('*, project:projects(id, name, key)')
      .single();

    if (error) {
      console.error('error. failed to update sprint status:', error.message);
      throw new Error('Failed to update sprint status');
    }

    return data as unknown as SprintRowWithProject;
  }

  async findById(
    userId: string,
    sprintId: string
  ): Promise<SprintRowWithProject | null> {
    const { data, error } = await supabase
      .from('sprints')
      .select('*, project:projects(id, name, key)')
      .eq('id', sprintId)
      .eq('created_by', userId)
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
        updated_at: new Date().toISOString(),
      })
      .eq('id', sprintId)
      .eq('created_by', userId)
      .select('*, project:projects(id, name, key)')
      .single();

    if (error) {
      console.error('error. failed to update sprint:', error.message);
      throw new Error('Failed to update sprint');
    }

    return data as unknown as SprintRowWithProject;
  }
}

export const sprintsRepository = new SprintsRepository();
