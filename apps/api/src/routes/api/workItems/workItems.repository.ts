import { Tables, userRelationSelect } from '@repo/types';
import { supabase } from '../../../lib/supabase';
import { auditCreateWithoutStatus } from '../../../lib/audit';
import { WorkItemBody, WorkItemUpdateBody } from './workItems.schemas';

export type DbWorkItem = Tables<'work_items'>;

export type CreateWorkItemRecord = WorkItemBody & {
  createdBy: string;
};

export type UpdateWorkItemRecord = WorkItemUpdateBody & {
  id: string;
  updatedBy: string;
};

const ASSIGNEE_SELECT = userRelationSelect('assignee', 'assignee_id');
const REPORTER_SELECT = userRelationSelect('reporter', 'reporter_id');
const WORK_ITEM_WITH_ASSIGNEE = `*, ${ASSIGNEE_SELECT}`;
const WORK_ITEM_WITH_PEOPLE = `*, ${ASSIGNEE_SELECT}, ${REPORTER_SELECT}`;

export class WorkItemRepository {
  async get(filters?: { sprint_id?: string | null }): Promise<DbWorkItem[]> {
    let query = supabase.from('work_items').select(WORK_ITEM_WITH_ASSIGNEE);

    if (filters) {
      if (filters.sprint_id === null) {
        query = query.is('sprint_id', null);
      } else if (filters.sprint_id) {
        query = query.eq('sprint_id', filters.sprint_id);
      }
    }

    const { data, error } = await query.order('created_at', {
      ascending: false,
    });

    if (error) {
      console.error('error. failed to list work-items:', error.message);
      throw new Error('Failed to list work-items');
    }

    return data as unknown as DbWorkItem[];
  }

  async listPaginated(
    page: number,
    limit: number,
    search?: string,
    filters?: { sprint_id?: string | null }
  ): Promise<{ workItems: DbWorkItem[]; totalCount: number }> {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase.from('work_items').select(WORK_ITEM_WITH_ASSIGNEE, {
      count: 'exact',
    });

    if (search?.trim()) {
      query = query.ilike('title', `%${search.trim()}%`);
    }

    if (filters) {
      if (filters.sprint_id === null) {
        query = query.is('sprint_id', null);
      } else if (filters.sprint_id) {
        query = query.eq('sprint_id', filters.sprint_id);
      }
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      console.error(
        'error. failed to list work-items paginated:',
        error.message
      );
      throw new Error('Failed to list work-items');
    }

    return {
      workItems: (data ?? []) as unknown as DbWorkItem[],
      totalCount: count ?? 0,
    };
  }

  async getById(workItemId: string): Promise<DbWorkItem> {
    const { data, error } = await supabase
      .from('work_items')
      .select(WORK_ITEM_WITH_PEOPLE)
      .eq('id', workItemId)
      .maybeSingle();

    if (error) {
      console.error('error. failed to get work-item:', error.message);
      throw new Error('Failed to get work-item');
    }

    return data as unknown as DbWorkItem;
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
        sprint_id: input.sprint_id,
        reporter_id: input.createdBy,
        status: 'New',
        story_points: input.story_points,
        ...auditCreateWithoutStatus(input.createdBy),
      })
      .select(WORK_ITEM_WITH_ASSIGNEE)
      .single();

    if (error) {
      console.error('error. failed to create work-item:', error.message);
      throw new Error('Failed to create work-item');
    }

    return data as unknown as DbWorkItem;
  }

  async update(input: UpdateWorkItemRecord): Promise<DbWorkItem> {
    const { data, error } = await supabase
      .from('work_items')
      .update({
        title: input.title,
        project_id: input.project_id,
        type: input.type,
        assignee_id: input.assignee_id,
        reporter_id: input.reporter_id,
        due_date: input.due_date,
        description: input.description,
        status: input.status,
        sprint_id: input.sprint_id,
        story_points: input.story_points,
        updated_by: input.updatedBy,
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.id)
      .select(WORK_ITEM_WITH_PEOPLE)
      .single();

    if (error) {
      console.error('error. failed to update work-item:', error.message);
      throw new Error('Failed to update work-item');
    }

    return data as unknown as DbWorkItem;
  }
}

export const workItemRepository = new WorkItemRepository();
