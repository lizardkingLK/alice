import { Tables } from '@repo/types';
import { supabase } from '../../../lib/supabase';
import { auditCreateWithoutStatus } from '../../../lib/audit';
import { WorkItemBody } from './workItems.schemas';

export type DbWorkItem = Tables<'work_items'>;

export type CreateWorkItemRecord = WorkItemBody & {
  createdBy: string;
};

export type UpdateWorkItemRecord = WorkItemBody & {
  id: string;
  updatedBy: string;
};

export class WorkItemRepository {
  async listAll(): Promise<DbWorkItem[]> {
    const { data, error } = await supabase
      .from('work_items')
      .select('*, assignee:users!assignee_id(id, name, email)')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('error. failed to list work-items:', error.message);
      throw new Error('Failed to list work-items');
    }

    return data as DbWorkItem[];
  }

  async create(input: CreateWorkItemRecord): Promise<DbWorkItem> {
    const { data, error } = await supabase
      .from('work_items')
      .insert({
        title: input.title,
        project_id: input.project_id,
        type: input.type,
        assignee_id: input.assignee_id,
        due_date: input.due_date,
        reporter_id: input.createdBy,
        status: 'New',
        ...auditCreateWithoutStatus(input.createdBy),
      })
      .select('*, assignee:users!assignee_id(id, name, email)')
      .single();

    if (error) {
      console.error('error. failed to create work-item:', error.message);
      throw new Error('Failed to create work-item');
    }

    return data as DbWorkItem;
  }

  async update(input: UpdateWorkItemRecord): Promise<DbWorkItem> {
    const { data, error } = await supabase
      .from('work_items')
      .update({
        title: input.title,
        project_id: input.project_id,
        type: input.type,
        assignee_id: input.assignee_id,
        due_date: input.due_date,
        updated_by: input.updatedBy,
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.id)
      .select('*, assignee:users!assignee_id(id, name, email)')
      .single();

    if (error) {
      console.error('error. failed to update work-item:', error.message);
      throw new Error('Failed to update work-item');
    }

    return data as DbWorkItem;
  }
}

export const workItemRepository = new WorkItemRepository();
