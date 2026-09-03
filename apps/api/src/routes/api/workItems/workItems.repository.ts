import {
  Tables,
  userRelationSelect,
  DEFAULT_WORK_ITEM_PRIORITY,
  WorkItemStatusEnum,
  type Database,
  workItemDetailSelect,
  workItemListSelect,
  workItemListSelectWithDescription,
  type WorkItemDetailRow,
  type WorkItemListRow,
  type WorkItemListRowWithDescription,
  type WorkItemPrismaListFilters,
  paginationMeta,
} from '@repo/types';
import { Prisma } from '@repo/types/prisma';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  listAccessibleProjectIds,
  ALL_PROJECTS,
} from '../../../lib/project-access';
import { prisma } from '../../../lib/prisma';
import {
  prismaAuditCreateWithoutStatus,
  prismaAuditUpdate,
  prismaLockTimestamp,
  prismaOptionalDate,
} from '../../../lib/prisma-audit';
import { resolveOptimisticPrismaUpdate } from '../../../lib/optimistic-lock';
import { WorkItemAccessError } from './workItems.errors';
import { WorkItemBody, WorkItemUpdateBody } from './workItems.schemas';
import {
  buildWorkItemPrismaListWhere,
  workItemListPageSlice,
  type WorkItemPaginatedList,
} from './workItems.prisma-query';

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
const WORK_ITEM_WITH_PEOPLE = `*, ${ASSIGNEE_SELECT}, ${REPORTER_SELECT}`;

export class WorkItemRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  /**
   * Admin: all projects. Member/manager: active membership ∪ owned projects.
   */
  async listAccessibleProjectIds(
    actorId: string
  ): Promise<typeof ALL_PROJECTS | string[]> {
    return listAccessibleProjectIds(this.db, actorId);
  }

  async assertCanAccessProject(
    actorId: string,
    projectId: string
  ): Promise<void> {
    const accessible = await this.listAccessibleProjectIds(actorId);
    if (accessible === ALL_PROJECTS) {
      return;
    }
    if (!accessible.includes(projectId)) {
      throw new WorkItemAccessError();
    }
  }

  async requireProjectMember(
    workItemId: string,
    actorId: string
  ): Promise<{ projectId: string }> {
    const { data: workItem, error: workItemError } = await this.db
      .from('work_items')
      .select('project_id')
      .eq('id', workItemId)
      .maybeSingle();

    if (workItemError) {
      console.error(
        'error. failed to load work-item for project access:',
        workItemError.message
      );
      throw new Error('Failed to authorize work-item access');
    }

    if (!workItem) {
      throw new Error('Work item not found');
    }

    await this.assertCanAccessProject(actorId, workItem.project_id);
    return { projectId: workItem.project_id };
  }

  /**
   * Unused Express list path (Prisma). Do not call from mutation/lock flows —
   * those still use supabase-js `getById`.
   */
  async listPaginated(input: {
    filters?: WorkItemPrismaListFilters;
    search?: string;
    page: number;
    limit: number;
    includeDescription?: boolean;
  }): Promise<
    WorkItemPaginatedList<WorkItemListRow | WorkItemListRowWithDescription>
  > {
    const where = buildWorkItemPrismaListWhere(input.filters, input.search);
    const { skip, take } = workItemListPageSlice(input.page, input.limit);
    const select = input.includeDescription
      ? workItemListSelectWithDescription
      : workItemListSelect;

    try {
      const [workItems, totalCount] = await Promise.all([
        prisma.work_items.findMany({
          where,
          select,
          orderBy: { created_at: 'desc' },
          skip,
          take,
        }),
        prisma.work_items.count({ where }),
      ]);

      return {
        workItems,
        ...paginationMeta(totalCount, input.page, input.limit),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('error. failed to list work-items:', message);
      throw new Error('Failed to list work-items');
    }
  }

  /**
   * Unused Express detail path (Prisma). Mutation optimistic-lock still uses
   * supabase-js `getById`.
   */
  async getDetailById(workItemId: string): Promise<WorkItemDetailRow | null> {
    try {
      return await prisma.work_items.findUnique({
        where: { id: workItemId },
        select: workItemDetailSelect,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('error. failed to get work-item detail:', message);
      throw new Error('Failed to get work-item');
    }
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
      .eq('record_status', 'active')
      .neq('status', WorkItemStatusEnum.Done);

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
        status: input.status ?? WorkItemStatusEnum.New,
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

    const becomingDone =
      input.status === WorkItemStatusEnum.Done &&
      current?.status !== WorkItemStatusEnum.Done;
    const leavingDone =
      input.status !== WorkItemStatusEnum.Done &&
      current?.status === WorkItemStatusEnum.Done;

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

  /**
   * BFS collect of `rootId` and every descendant via `parent_id`.
   * Order is root-first; callers that need leaves-first should reverse.
   */
  async collectDescendantIds(rootId: string): Promise<string[]> {
    const collected: string[] = [];
    let frontier = [rootId];

    while (frontier.length > 0) {
      collected.push(...frontier);
      const children = await prisma.work_items.findMany({
        where: { parent_id: { in: frontier } },
        select: { id: true },
      });
      frontier = children.map((child) => child.id);
    }

    return collected;
  }

  async setRecordStatusForSubtree(
    rootId: string,
    recordStatus: 'active' | 'archived',
    actorId: string,
    expectedUpdatedAt: string,
    options?: {
      /** When restoring a child, clear `parent_id` so it becomes a root. */
      readonly unlinkFromParent?: boolean;
    }
  ): Promise<DbWorkItem> {
    const ids = await this.collectDescendantIds(rootId);
    const audit = prismaAuditUpdate(actorId);
    const unlinkFromParent = Boolean(options?.unlinkFromParent);

    const { count } = await prisma.$transaction(async (tx) => {
      const rootUpdate = await tx.work_items.updateMany({
        where: {
          id: rootId,
          updated_at: prismaLockTimestamp(expectedUpdatedAt),
        },
        data: {
          record_status: recordStatus,
          ...(unlinkFromParent ? { parent_id: null } : {}),
          ...audit,
        },
      });

      if (rootUpdate.count > 0) {
        const childIds = ids.filter((id) => id !== rootId);
        if (childIds.length > 0) {
          await tx.work_items.updateMany({
            where: { id: { in: childIds } },
            data: {
              record_status: recordStatus,
              ...audit,
            },
          });
        }
      }

      return rootUpdate;
    });

    return resolveOptimisticPrismaUpdate({
      count,
      fetchUpdated: () => this.getById(rootId),
      fetchCurrent: () => this.getById(rootId),
      notFoundMessage: 'Work item not found',
    });
  }

  async listAttachmentStoragePaths(workItemIds: string[]): Promise<string[]> {
    if (workItemIds.length === 0) {
      return [];
    }
    const rows = await prisma.attachments.findMany({
      where: { work_item_id: { in: workItemIds } },
      select: { storage_path: true },
    });
    return rows.map((row) => row.storage_path).filter(Boolean);
  }

  async deleteNotificationsForWorkItems(workItemIds: string[]): Promise<void> {
    if (workItemIds.length === 0) {
      return;
    }
    await prisma.notifications.deleteMany({
      where: { related_item_id: { in: workItemIds } },
    });
  }

  async deleteWorkItemsByIds(workItemIds: string[]): Promise<void> {
    if (workItemIds.length === 0) {
      return;
    }
    await prisma.work_items.deleteMany({
      where: { id: { in: workItemIds } },
    });
  }
}
