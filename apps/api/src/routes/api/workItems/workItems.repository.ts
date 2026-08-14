import {
  Tables,
  userRelationSelect,
  WORK_ITEM_WORKLOG_SELECT,
  normalizeWorkLogRow,
  DEFAULT_WORK_ITEM_PRIORITY,
  buildWorkItemSearchOrFilter,
  type Database,
  type WorkItemWorkLog,
  type WorkItemWorkLogRowRaw,
} from '@repo/types';
import { Prisma } from '@repo/types/prisma';
import type { SupabaseClient } from '@supabase/supabase-js';
import { prisma } from '../../../lib/prisma';
import {
  prismaAuditCreate,
  prismaAuditCreateWithoutStatus,
  prismaAuditUpdate,
  prismaLockTimestamp,
  prismaOptionalDate,
} from '../../../lib/prisma-audit';
import { resolveOptimisticPrismaUpdate } from '../../../lib/optimistic-lock';
import { WorkItemBody, WorkItemUpdateBody } from './workItems.schemas';

export type DbWorkItem = Tables<'work_items'>;

export interface DbGithubPullRequest {
  id: string;
  work_item_id: string;
  pr_number: number;
  repo_owner: string;
  repo_name: string;
  pr_title: string;
  pr_url: string;
  branch_name: string | null;
  status: string | null;
  created_at: string;
  updated_at: string;
}

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

  async requireProjectMember(
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

    // System administrators (role: 'admin') bypass project membership checks
    const { data: systemUser } = await this.db
      .from('users')
      .select('role')
      .eq('id', actorId)
      .maybeSingle();

    if (systemUser?.role === 'manager' || systemUser?.role === 'admin') {
      return { projectId: workItem.project_id };
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
      query = query.or(buildWorkItemSearchOrFilter(search));
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
    const created = await prisma.work_items.create({
      data: {
        title: input.title,
        project_id: input.project_id,
        type: input.type,
        priority: input.priority ?? DEFAULT_WORK_ITEM_PRIORITY,
        assignee_id: input.assignee_id,
        due_date: prismaOptionalDate(input.due_date) ?? null,
        sprint_id: input.sprint_id,
        reporter_id: input.createdBy,
        status: 'New',
        story_points: input.story_points,
        jira_issue_key: input.jira_issue_key,
        description:
          input.description == null
            ? Prisma.DbNull
            : (input.description as Prisma.InputJsonValue),
        labels: (input.labels ?? []) as Prisma.InputJsonValue,
        parent_id: input.parent_id ?? null,
        ...prismaAuditCreateWithoutStatus(input.createdBy),
      },
    });

    const row = await this.getById(created.id);
    if (!row) {
      throw new Error('Failed to create work-item');
    }
    return row;
  }

  async update(input: UpdateWorkItemRecord): Promise<DbWorkItem> {
    const current = await this.getById(input.id);

    const becomingDone = input.status === 'Done' && current?.status !== 'Done';
    const leavingDone = input.status !== 'Done' && current?.status === 'Done';

    let doneAtUpdate: Date | null | undefined;
    if (becomingDone) {
      doneAtUpdate = new Date();
    } else if (leavingDone) {
      doneAtUpdate = null;
    }

    let descriptionUpdate:
      Prisma.InputJsonValue | typeof Prisma.DbNull | undefined;
    if (input.description !== undefined) {
      descriptionUpdate =
        input.description == null
          ? Prisma.DbNull
          : (input.description as Prisma.InputJsonValue);
    }

    const { count } = await prisma.work_items.updateMany({
      where: {
        id: input.id,
        updated_at: prismaLockTimestamp(input.expectedUpdatedAt),
      },
      data: {
        title: input.title,
        project_id: input.project_id,
        type: input.type,
        priority: input.priority ?? DEFAULT_WORK_ITEM_PRIORITY,
        assignee_id: input.assignee_id,
        reporter_id: input.reporter_id,
        due_date: prismaOptionalDate(input.due_date) ?? null,
        description: descriptionUpdate,
        labels: (input.labels ?? []) as Prisma.InputJsonValue,
        status: input.status,
        sprint_id: input.sprint_id,
        story_points: input.story_points,
        parent_id: input.parent_id ?? null,
        ...(input.jira_issue_key !== undefined
          ? { jira_issue_key: input.jira_issue_key }
          : {}),
        ...(doneAtUpdate !== undefined ? { done_at: doneAtUpdate } : {}),
        ...prismaAuditUpdate(input.updatedBy),
      },
    });

    return resolveOptimisticPrismaUpdate({
      count,
      fetchUpdated: () => this.getById(input.id),
      fetchCurrent: () => this.getById(input.id),
      notFoundMessage: 'Work item not found',
    });
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

    const created = await prisma.work_item_worklogs.create({
      data: {
        work_item_id: input.workItemId,
        user_id: input.actorId,
        logged_hours: input.loggedHours,
        logged_at: prismaOptionalDate(input.loggedAtIso)!,
        comment: input.comment,
        ...prismaAuditCreate(input.actorId),
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = this.db as unknown as SupabaseClient<any>;

    const { data, error } = await db
      .from('work_item_worklogs')
      .select(WORK_ITEM_WORKLOG_SELECT)
      .eq('id', created.id)
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

  async listLinkedPRs(workItemId: string): Promise<DbGithubPullRequest[]> {
    const db = this.db as unknown as SupabaseClient<Database>;

    const { data, error } = await db
      .from('github_pull_requests')
      .select('*')
      .eq('work_item_id', workItemId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('error. failed to list linked github PRs:', error.message);
      throw new Error('Failed to list linked PRs');
    }

    return data ?? [];
  }

  async linkPR(
    workItemId: string,
    payload: {
      prNumber: number;
      repoOwner: string;
      repoName: string;
      prTitle: string;
      prUrl: string;
      branchName?: string | null;
      status?: string | null;
    }
  ): Promise<DbGithubPullRequest> {
    const upserted = await prisma.github_pull_requests.upsert({
      where: {
        work_item_id_repo_owner_repo_name_pr_number: {
          work_item_id: workItemId,
          repo_owner: payload.repoOwner,
          repo_name: payload.repoName,
          pr_number: payload.prNumber,
        },
      },
      create: {
        work_item_id: workItemId,
        pr_number: payload.prNumber,
        repo_owner: payload.repoOwner,
        repo_name: payload.repoName,
        pr_title: payload.prTitle,
        pr_url: payload.prUrl,
        branch_name: payload.branchName ?? null,
        status: payload.status ?? 'open',
      },
      update: {
        pr_title: payload.prTitle,
        pr_url: payload.prUrl,
        branch_name: payload.branchName ?? null,
        status: payload.status ?? 'open',
        updated_at: new Date(),
      },
    });

    const db = this.db as unknown as SupabaseClient<Database>;
    const { data, error } = await db
      .from('github_pull_requests')
      .select('*')
      .eq('id', upserted.id)
      .single();

    if (error) {
      console.error('error. failed to link GitHub PR:', error.message);
      throw new Error('Failed to link GitHub PR');
    }

    return data;
  }

  async unlinkPR(workItemId: string, prId: string): Promise<void> {
    await prisma.github_pull_requests.deleteMany({
      where: { id: prId, work_item_id: workItemId },
    });
  }

  async getProjectGithubSettingsByWorkItem(workItemId: string): Promise<{
    github_repo: string | null;
    github_token: string | null;
  } | null> {
    const { data: workItem, error: workItemError } = await this.db
      .from('work_items')
      .select('project_id')
      .eq('id', workItemId)
      .maybeSingle();

    if (workItemError || !workItem) {
      return null;
    }

    const { data: project, error: projectError } = await this.db
      .from('projects')
      .select('github_repo, github_token')
      .eq('id', workItem.project_id)
      .maybeSingle();

    if (projectError || !project) {
      return null;
    }

    return project;
  }
}
