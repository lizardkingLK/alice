import { Tables, userRelationSelect, type Database } from '@repo/types';
import type { SupabaseClient } from '@supabase/supabase-js';
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

type SprintIdFilters = { sprint_id?: string | null };

type SprintFilterableQuery = {
  is: (column: 'sprint_id', value: null) => SprintFilterableQuery;
  eq: (column: 'sprint_id', value: string) => SprintFilterableQuery;
};

function applySprintIdFilter<Q extends SprintFilterableQuery>(
  query: Q,
  filters?: SprintIdFilters
): Q {
  if (!filters) {
    return query;
  }
  if (filters.sprint_id === null) {
    return query.is('sprint_id', null) as Q;
  }
  if (filters.sprint_id) {
    return query.eq('sprint_id', filters.sprint_id) as Q;
  }
  return query;
}

export class WorkItemRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async get(filters?: SprintIdFilters): Promise<DbWorkItem[]> {
    const query = applySprintIdFilter(
      this.db.from('work_items').select(WORK_ITEM_WITH_ASSIGNEE),
      filters
    );

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
    filters?: SprintIdFilters
  ): Promise<{ workItems: DbWorkItem[]; totalCount: number }> {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = this.db.from('work_items').select(WORK_ITEM_WITH_ASSIGNEE, {
      count: 'exact',
    });

    if (search?.trim()) {
      query = query.ilike('title', `%${search.trim()}%`);
    }

    query = applySprintIdFilter(query, filters);

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
    const { data, error } = await this.db
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
    const { data, error } = await this.db
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
    const { data, error } = await this.db
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
