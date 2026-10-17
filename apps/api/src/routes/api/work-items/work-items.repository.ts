import {
  Tables,
  userRelationSelect,
  DEFAULT_WORK_ITEM_PRIORITY,
  WorkItemStatusEnum,
  type Database,
  doneAtForCategoryChange,
  resolveWorkItemState,
  syncWorkItemStateForStatusChange,
  workItemStateToJson,
  workItemDetailSelect,
  workItemListSelect,
  workItemListSelectWithDescription,
  type WorkItemDetailRow,
  type WorkItemListRow,
  type WorkItemListRowWithDescription,
  type WorkItemPrismaListFilters,
  type WorkItemState,
  paginationMeta,
  type UserRole,
  RecordStatusEnum,
  toDateOnly,
  normalizedAllowlistProjectKeysFromValue,
  resolveProjectIdsFromAllowlistValue,
} from '@repo/types';
import {
  AccessAllowlistKind,
  Prisma,
  RecordStatus,
  UserMembershipStatus,
} from '@repo/types/prisma';
import type { SupabaseClient } from '@supabase/supabase-js';
import { listAccessibleProjectIds } from '../../../lib/project-access';
import { prisma } from '../../../lib/prisma';
import {
  prismaAuditCreateWithoutStatus,
  prismaAuditUpdate,
  prismaLockTimestampRange,
  prismaOptionalDate,
} from '../../../lib/prisma-audit';
import { resolveOptimisticPrismaUpdate } from '../../../lib/optimistic-lock';
import { WorkItemAccessError } from './work-items.errors';
import { WorkItemBody, WorkItemUpdateBody } from './work-items.schemas';
import {
  buildWorkItemPrismaListWhere,
  workItemListPageSlice,
  type WorkItemPaginatedList,
} from './work-items.prisma-query';

export type DbWorkItem = Tables<'work_items'>;

/**
 * Map a Prisma mutation select (assignee/reporter embeds) to the PostgREST
 * wire shape mutation callers already consume (`DbWorkItem` + people embeds).
 */
export function mapPrismaWorkItemMutationRow(
  row: WorkItemListRowWithDescription
): DbWorkItem {
  return {
    ...row,
    due_date: row.due_date
      ? (toDateOnly(row.due_date.toISOString()) as string)
      : null,
    done_at: row.done_at?.toISOString() ?? null,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  } as unknown as DbWorkItem;
}

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

export type BoardActorContext = {
  role: UserRole;
  isActiveProjectMember: boolean;
  activeTeamIds: string[];
};

export type CreateWorkItemRecord = WorkItemBody & {
  createdBy: string;
  /** Project workflow resolved for this type; defaults to seeded id when omitted. */
  workflowId?: string;
};

export type UpdateWorkItemRecord = WorkItemUpdateBody & {
  id: string;
  updatedBy: string;
  expectedUpdatedAt: string;
  /**
   * When set (graph workflow moves), persist this state instead of bridging
   * category from status alone — required for draft destinations with null
   * `board_column_id`.
   */
  stateOverride?: WorkItemState;
  /**
   * Pre-loaded row from the service. When set, skips a duplicate supabase
   * `getById` before `updateMany`.
   */
  current?: DbWorkItem;
};

const ASSIGNEE_SELECT = userRelationSelect('assignee', 'assignee_id');
const REPORTER_SELECT = userRelationSelect('reporter', 'reporter_id');
const WORK_ITEM_WITH_PEOPLE = `*, ${ASSIGNEE_SELECT}, ${REPORTER_SELECT}`;

export class WorkItemRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  /**
   * Membership ∪ ownership (same for every role — “my projects”).
   */
  async listAccessibleProjectIds(actorId: string): Promise<string[]> {
    return listAccessibleProjectIds(this.db, actorId);
  }

  async assertCanAccessProject(
    actorId: string,
    projectId: string
  ): Promise<void> {
    const accessible = await this.listAccessibleProjectIds(actorId);
    if (!accessible.includes(projectId)) {
      throw new WorkItemAccessError();
    }
  }

  /**
   * Scoped project access for hot mutations (board status). Checks owner ∪
   * active membership ∪ guest email ACL for **this** project id only — does
   * not list every accessible project.
   */
  async assertCanAccessProjectId(
    actorId: string,
    projectId: string
  ): Promise<void> {
    try {
      const user = await prisma.users.findFirst({
        where: {
          id: actorId,
          active: true,
          membership_status: UserMembershipStatus.active,
        },
        select: {
          email: true,
          owned_projects: {
            where: { id: projectId },
            select: { id: true },
            take: 1,
          },
          project_memberships: {
            where: { project_id: projectId, status: RecordStatus.active },
            select: { project_id: true },
            take: 1,
          },
        },
      });

      if (!user) {
        throw new WorkItemAccessError();
      }

      const allowlist = await prisma.access_allowlist.findFirst({
        where: {
          status: RecordStatus.active,
          kind: AccessAllowlistKind.email,
          value: user.email.trim().toLowerCase(),
        },
        select: { allowed_project_ids: true },
      });

      if (allowlist) {
        const keys = normalizedAllowlistProjectKeysFromValue(
          allowlist.allowed_project_ids
        );
        if (keys.length === 0) {
          throw new WorkItemAccessError();
        }
        const matched = await prisma.projects.findMany({
          where: { key: { in: keys } },
          select: { id: true, key: true },
        });
        const allowedIds = resolveProjectIdsFromAllowlistValue(
          allowlist.allowed_project_ids,
          matched
        );
        if (!allowedIds.includes(projectId)) {
          throw new WorkItemAccessError();
        }
        return;
      }

      if (
        user.owned_projects.length === 0 &&
        user.project_memberships.length === 0
      ) {
        throw new WorkItemAccessError();
      }
    } catch (error) {
      if (error instanceof WorkItemAccessError) {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      console.error('error. failed scoped project access check:', message);
      throw new Error('Failed to authorize project access');
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
   * Express list path (Prisma). Optional twin for `DATA_READS_VIA_API`.
   * Mutation happy-path returns use {@link getMutationRowById}.
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
   * Express detail path (Prisma). Optional twin for `DATA_READS_VIA_API`.
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

  /**
   * Post-mutation / optimistic-lock row via Prisma (no PostgREST hop).
   * Select matches assignee/reporter embeds used by supabase `getById`.
   */
  async getMutationRowById(workItemId: string): Promise<DbWorkItem | null> {
    try {
      const row = await prisma.work_items.findUnique({
        where: { id: workItemId },
        select: workItemListSelectWithDescription,
      });
      if (!row) {
        return null;
      }
      return mapPrismaWorkItemMutationRow(row);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('error. failed to get work-item mutation row:', message);
      throw new Error('Failed to get work-item');
    }
  }

  /**
   * Pre-write reads and legacy callers — supabase-js with people embeds.
   * Prefer {@link getMutationRowById} after Prisma writes.
   */
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

  async getProjectWorkflowConfig(
    projectId: string
  ): Promise<Tables<'projects'>['workflow_config']> {
    try {
      const data = await prisma.projects.findUnique({
        where: { id: projectId },
        select: { workflow_config: true },
      });

      if (!data) {
        throw new WorkItemAccessError();
      }

      return data.workflow_config as Tables<'projects'>['workflow_config'];
    } catch (error) {
      if (error instanceof WorkItemAccessError) {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      console.error('error. failed to load project workflow config:', message);
      throw new Error('Failed to validate board column');
    }
  }

  /** Resolve all actor facts needed by a board rule in one database query. */
  async getBoardActorContext(
    actorId: string,
    projectId: string
  ): Promise<BoardActorContext | null> {
    const actor = await prisma.users.findFirst({
      where: {
        id: actorId,
        active: true,
        membership_status: UserMembershipStatus.active,
      },
      select: {
        role: true,
        project_memberships: {
          where: {
            project_id: projectId,
            status: RecordStatus.active,
          },
          select: { user_id: true },
        },
        team_memberships: {
          where: {
            status: RecordStatus.active,
            team: {
              project_id: projectId,
              status: RecordStatus.active,
            },
          },
          select: { team_id: true },
        },
      },
    });

    if (!actor) return null;

    return {
      role: actor.role,
      isActiveProjectMember: actor.project_memberships.length > 0,
      activeTeamIds: actor.team_memberships.map(
        (membership) => membership.team_id
      ),
    };
  }

  /** Count direct children (active + archived) for hierarchy type-change gates. */
  async countDirectChildren(parentId: string): Promise<number> {
    return await prisma.work_items.count({
      where: { parent_id: parentId },
    });
  }

  /** Clear parent_id for every direct child of `parentId`. */
  async detachDirectChildren(parentId: string): Promise<number> {
    const result = await prisma.work_items.updateMany({
      where: { parent_id: parentId },
      data: { parent_id: null },
    });
    return result.count;
  }

  /** Align sprint_id for descendant work items (excludes `rootId`). */
  async updateSprintForDescendants(
    rootId: string,
    sprintId: string | null,
    updatedBy: string
  ): Promise<string[]> {
    const ids = await this.collectDescendantIds(rootId);
    const descendantIds = ids.filter((id) => id !== rootId);
    if (descendantIds.length === 0) {
      return [];
    }

    await prisma.work_items.updateMany({
      where: {
        id: { in: descendantIds },
        record_status: RecordStatusEnum.active,
      },
      data: {
        sprint_id: sprintId,
        ...prismaAuditUpdate(updatedBy),
      },
    });
    return descendantIds;
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

  /**
   * Count direct children that are not yet in the parent's target state
   * (or same category when state ids differ across workflows).
   */
  async countChildrenNotInTargetState(
    parentId: string,
    targetStateId: string,
    targetCategory: string
  ): Promise<number> {
    const { data, error } = await this.db
      .from('work_items')
      .select('id, status, state, board_column_id')
      .eq('parent_id', parentId)
      .eq('record_status', 'active');

    if (error) {
      console.error(
        'error. failed to list children for target-state gate:',
        error.message
      );
      throw new Error('Failed to list children for target-state gate');
    }

    let mismatched = 0;
    for (const child of data ?? []) {
      const resolved = resolveWorkItemState({
        state: child.state,
        status: child.status,
        boardColumnId: child.board_column_id,
      });
      const matchesState =
        resolved.stateId === targetStateId ||
        child.board_column_id === targetStateId ||
        child.status === targetStateId;
      const matchesCategory = resolved.category === targetCategory;
      if (!matchesState && !matchesCategory) {
        mismatched += 1;
      }
    }
    return mismatched;
  }

  async create(input: CreateWorkItemRecord): Promise<DbWorkItem> {
    const status = input.status ?? WorkItemStatusEnum.New;
    const synced = syncWorkItemStateForStatusChange({
      nextStatus: status,
      previousState: null,
      workflowId: input.workflowId,
    });

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
        status: synced.status,
        state: workItemStateToJson(synced.state) as Prisma.InputJsonValue,
        ...(synced.doneAt !== undefined ? { done_at: synced.doneAt } : {}),
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

    const row = await this.getMutationRowById(created.id);
    if (!row) {
      throw new Error('Failed to create work-item');
    }
    return row;
  }

  async update(input: UpdateWorkItemRecord): Promise<DbWorkItem> {
    const current = input.current ?? (await this.getById(input.id));

    const previousState = current
      ? resolveWorkItemState({
          state: current.state,
          status: current.status,
          boardColumnId: current.board_column_id,
        })
      : null;

    const synced = input.stateOverride
      ? {
          state: input.stateOverride,
          status: input.status,
          doneAt: doneAtForCategoryChange({
            previousCategory: previousState?.category,
            nextCategory: input.stateOverride.category,
          }),
        }
      : syncWorkItemStateForStatusChange({
          nextStatus: input.status,
          previousState,
          boardColumnId: input.board_column_id,
        });

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
        updated_at: prismaLockTimestampRange(input.expectedUpdatedAt),
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
        status: synced.status,
        state: workItemStateToJson(synced.state) as Prisma.InputJsonValue,
        board_column_id: input.board_column_id,
        sprint_id: input.sprint_id,
        story_points: input.story_points,
        parent_id: input.parent_id ?? null,
        ...(input.jira_issue_key !== undefined
          ? { jira_issue_key: input.jira_issue_key }
          : {}),
        ...(synced.doneAt !== undefined ? { done_at: synced.doneAt } : {}),
        ...prismaAuditUpdate(input.updatedBy),
      },
    });

    return resolveOptimisticPrismaUpdate({
      count,
      fetchUpdated: () => this.getMutationRowById(input.id),
      fetchCurrent: () => this.getMutationRowById(input.id),
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
   *
   * Loads the project's parent links in one query, then walks in memory so we
   * never `await` per BFS level (Sonar S2982 / S5382). Levels cannot be
   * `Promise.all`'d — each frontier depends on the previous.
   */
  async collectDescendantIds(rootId: string): Promise<string[]> {
    const root = await prisma.work_items.findUnique({
      where: { id: rootId },
      select: { project_id: true },
    });

    if (!root) {
      return [rootId];
    }

    const rows = await prisma.work_items.findMany({
      where: { project_id: root.project_id },
      select: { id: true, parent_id: true },
    });

    const childrenByParent = new Map<string, string[]>();
    for (const row of rows) {
      if (row.parent_id == null) {
        continue;
      }
      const siblings = childrenByParent.get(row.parent_id);
      if (siblings) {
        siblings.push(row.id);
      } else {
        childrenByParent.set(row.parent_id, [row.id]);
      }
    }

    const collected: string[] = [];
    let frontier = [rootId];
    while (frontier.length > 0) {
      collected.push(...frontier);
      frontier = frontier.flatMap((id) => childrenByParent.get(id) ?? []);
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
          updated_at: prismaLockTimestampRange(expectedUpdatedAt),
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
      fetchUpdated: () => this.getMutationRowById(rootId),
      fetchCurrent: () => this.getMutationRowById(rootId),
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
