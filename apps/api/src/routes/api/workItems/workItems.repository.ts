import {
  Tables,
  userRelationSelect,
  WORK_ITEM_WORKLOG_SELECT,
  normalizeWorkLogRow,
  type Database,
  type WorkItemWorkLog,
  type WorkItemWorkLogRowRaw,
} from '@repo/types';
import type { SupabaseClient } from '@supabase/supabase-js';
import { auditCreate, auditCreateWithoutStatus } from '../../../lib/audit';
import { resolveOptimisticUpdate } from '../../../lib/optimistic-lock';
import { WorkItemBody, WorkItemUpdateBody } from './workItems.schemas';

export type DbWorkItem = Tables<'work_items'>;

export type CreateWorkItemRecord = WorkItemBody & {
  createdBy: string;
};

export type UpdateWorkItemRecord = WorkItemUpdateBody & {
  id: string;
  updatedBy: string;
  expectedUpdatedAt: string;
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

  private async requireProjectMember(
    workItemId: string,
    actorId: string
  ): Promise<{ projectId: string }> {
    // Supabase's generated DB types don't yet include `work_item_worklogs`,
    // so we cast to access the new table safely.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = this.db as unknown as SupabaseClient<any>;

    const { data: workItem, error: workItemError } = await this.db
      .from('work_items')
      .select('project_id')
      .eq('id', workItemId)
      .maybeSingle();

    if (workItemError) {
      console.error(
        'error. failed to load work-item for worklog auth:',
        workItemError.message
      );
      throw new Error('Failed to authorize worklog');
    }

    if (!workItem) {
      throw new Error('Work item not found');
    }

    const { data: member, error: memberError } = await db
      .from('project_members')
      .select('user_id')
      .eq('project_id', workItem.project_id)
      .eq('user_id', actorId)
      .eq('status', 'active')
      .maybeSingle();

    if (memberError) {
      console.error(
        'error. failed to verify project membership for worklog:',
        memberError.message
      );
      throw new Error('Failed to authorize worklog');
    }

    if (!member) {
      throw new Error('Unauthorized');
    }

    return { projectId: workItem.project_id };
  }

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

  /** Count direct children that are not yet Done (for Done-gate validation). */
  async countIncompleteChildren(parentId: string): Promise<number> {
    const { count, error } = await this.db
      .from('work_items')
      .select('id', { count: 'exact', head: true })
      .eq('parent_id', parentId)
      .neq('status', 'Done');

    if (error) {
      console.error(
        'error. failed to count incomplete children:',
        error.message
      );
      throw new Error('Failed to count incomplete children');
    }

    return count ?? 0;
  }

  async create(input: CreateWorkItemRecord): Promise<DbWorkItem> {
    const { data, error } = await this.db
      .from('work_items')
      .insert({
        title: input.title,
        project_id: input.project_id,
        type: input.type,
        priority: input.priority ?? 'medium',
        assignee_id: input.assignee_id,
        due_date: input.due_date,
        sprint_id: input.sprint_id,
        reporter_id: input.createdBy,
        status: 'New',
        story_points: input.story_points,
        jira_issue_key: input.jira_issue_key,
        description: input.description ?? null,
        parent_id: input.parent_id ?? null,
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
    const current = await this.getById(input.id);

    const becomingDone = input.status === 'Done' && current?.status !== 'Done';
    const leavingDone = input.status !== 'Done' && current?.status === 'Done';

    let doneAtUpdate: string | null | undefined;
    if (becomingDone) {
      doneAtUpdate = new Date().toISOString();
    } else if (leavingDone) {
      doneAtUpdate = null;
    }

    const { data, error } = await this.db
      .from('work_items')
      .update({
        title: input.title,
        project_id: input.project_id,
        type: input.type,
        priority: input.priority ?? 'medium',
        assignee_id: input.assignee_id,
        reporter_id: input.reporter_id,
        due_date: input.due_date,
        description: input.description,
        status: input.status,
        sprint_id: input.sprint_id,
        story_points: input.story_points,
        parent_id: input.parent_id ?? null,
        ...(input.jira_issue_key !== undefined
          ? { jira_issue_key: input.jira_issue_key }
          : {}),
        ...(doneAtUpdate !== undefined ? { done_at: doneAtUpdate } : {}),
        updated_by: input.updatedBy,
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.id)
      .eq('updated_at', input.expectedUpdatedAt)
      .select(WORK_ITEM_WITH_PEOPLE)
      .maybeSingle();

    return (await resolveOptimisticUpdate({
      data: data as unknown as DbWorkItem | null,
      error,
      fetchCurrent: () => this.getById(input.id),
      notFoundMessage: 'Work item not found',
    })) as DbWorkItem;
  }

  async listWorkItemWorkLogs(
    workItemId: string,
    actorId: string
  ): Promise<WorkItemWorkLog[]> {
    await this.requireProjectMember(workItemId, actorId);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = this.db as unknown as SupabaseClient<any>;

    const { data, error } = await db
      .from('work_item_worklogs')
      .select(WORK_ITEM_WORKLOG_SELECT)
      .eq('work_item_id', workItemId)
      .order('logged_at', { ascending: false });

    if (error) {
      console.error(
        'error. failed to list work item work logs:',
        error.message
      );
      throw new Error('Failed to list work logs');
    }

    const rows = (data ?? []) as unknown as WorkItemWorkLogRowRaw[];
    return rows.map((row) => normalizeWorkLogRow(row));
  }

  async createWorkItemWorkLog(input: {
    workItemId: string;
    actorId: string;
    loggedHours: number;
    loggedAtIso: string;
    comment: string | null;
  }): Promise<WorkItemWorkLog> {
    await this.requireProjectMember(input.workItemId, input.actorId);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = this.db as unknown as SupabaseClient<any>;

    const { data, error } = await db
      .from('work_item_worklogs')
      .insert({
        work_item_id: input.workItemId,
        user_id: input.actorId,
        logged_hours: input.loggedHours,
        logged_at: input.loggedAtIso,
        comment: input.comment,
        ...auditCreate(input.actorId),
      })
      .select(WORK_ITEM_WORKLOG_SELECT)
      .single();

    if (error || !data) {
      console.error(
        'error. failed to create work item work log:',
        error?.message
      );
      throw new Error('Failed to create work log');
    }

    return normalizeWorkLogRow(data as unknown as WorkItemWorkLogRowRaw);
  }
}
