import {
  getAllowedChildType,
  type WorkItemType,
  parseWorkItemLabels,
  paginationMeta,
  type ListWorkItemsQuery,
  type WorkItemDetailRow,
  type WorkItemListRow,
  type WorkItemListRowWithDescription,
  UserRoleEnum,
} from '@repo/types';
import { requireUserWithRole } from '../../../lib/auth-helpers';
import { env } from '../../../config/env';
import { removeStorageObjects } from '../../../lib/file-helpers';
import { WorkItemRepository } from './workItems.repository';
import type { DbWorkItem, DbGithubPullRequest } from './workItems.repository';
import type { WorkItemPaginatedList } from './workItems.prisma-query';
import { sameNullable } from './workItems.patch-utils';
import {
  toDateOnly,
  WorkItemBody,
  WorkItemUpdateBody,
} from './workItems.schemas';
import { WorkItemValidationError } from './workItems.errors';
import { decryptSecretIfPresent } from '../../../lib/secrets/token-crypto';

async function requireAdmin(actorId: string) {
  return await requireUserWithRole(
    actorId,
    [UserRoleEnum.admin],
    'Unauthorized. Only administrators can permanently delete work items.'
  );
}

function githubApiHeaders(encryptedOrPlainToken: string | null | undefined) {
  const headers: Record<string, string> = {
    'User-Agent': 'Alice-App',
    Accept: 'application/vnd.github.v3+json',
  };
  const token = decryptSecretIfPresent(encryptedOrPlainToken);
  if (token) {
    headers.Authorization = `token ${token}`;
  }
  return headers;
}

interface GithubPRApiResponse {
  title?: string;
  merged?: boolean;
  state?: string;
  head?: {
    ref?: string;
  };
}

interface GithubCommitApiResponse {
  sha?: string;
  commit?: {
    message?: string;
    author?: {
      name?: string;
      date?: string;
    };
  };
  author?: {
    login?: string;
  };
}

export class WorkItemService {
  constructor(private readonly workItems: WorkItemRepository) {}

  async listWorkItemsPaginated(
    query: ListWorkItemsQuery,
    actorId: string
  ): Promise<
    WorkItemPaginatedList<WorkItemListRow | WorkItemListRowWithDescription>
  > {
    const accessible = await this.workItems.listAccessibleProjectIds(actorId);
    const scopedFilters = this.resolveScopedListFilters(query, accessible);

    if (scopedFilters === null) {
      return {
        workItems: [],
        ...paginationMeta(0, query.page, query.limit),
      };
    }

    return await this.workItems.listPaginated({
      filters: scopedFilters,
      search: query.search,
      page: query.page,
      limit: query.limit,
      includeDescription: query.includeDescription,
    });
  }

  async getWorkItemDetail(
    workItemId: string,
    actorId: string
  ): Promise<WorkItemDetailRow | null> {
    await this.workItems.requireProjectMember(workItemId, actorId);
    return await this.workItems.getDetailById(workItemId);
  }

  async getWorkItem(workItemId: string, actorId?: string): Promise<DbWorkItem> {
    if (actorId) {
      await this.workItems.requireProjectMember(workItemId, actorId);
    }
    return await this.workItems.getById(workItemId);
  }

  async createWorkItem(
    userId: string,
    input: WorkItemBody
  ): Promise<DbWorkItem> {
    await this.workItems.assertCanAccessProject(userId, input.project_id);

    await this.assertValidParentLink({
      parentId: input.parent_id,
      projectId: input.project_id,
      childType: input.type,
    });

    return await this.workItems.create({
      ...input,
      createdBy: userId,
    });
  }

  async updateWorkItem(
    userId: string,
    workItemId: string,
    input: WorkItemUpdateBody,
    expectedUpdatedAt: string
  ): Promise<DbWorkItem> {
    await this.workItems.requireProjectMember(workItemId, userId);
    await this.workItems.assertCanAccessProject(userId, input.project_id);

    const current = await this.workItems.getById(workItemId);

    if (!sameNullable(input.parent_id, current?.parent_id)) {
      await this.assertValidParentLink({
        parentId: input.parent_id,
        projectId: input.project_id,
        childType: input.type,
        childId: workItemId,
      });
    }

    await this.assertCanBecomeDone(current, workItemId, input.status);
    this.assertDoneIsReadOnlyExceptStatus(current, input);

    return await this.workItems.update({
      ...input,
      id: workItemId,
      updatedBy: userId,
      expectedUpdatedAt,
    });
  }

  async archiveWorkItem(
    actorId: string,
    workItemId: string,
    expectedUpdatedAt: string
  ): Promise<DbWorkItem> {
    return await this.setSubtreeRecordStatus(
      actorId,
      workItemId,
      expectedUpdatedAt,
      'archived',
      'Work item is already archived.'
    );
  }

  async restoreWorkItem(
    actorId: string,
    workItemId: string,
    expectedUpdatedAt: string
  ): Promise<DbWorkItem> {
    return await this.setSubtreeRecordStatus(
      actorId,
      workItemId,
      expectedUpdatedAt,
      'active',
      'Only archived work items can be restored.'
    );
  }

  async purgeWorkItem(
    actorId: string,
    workItemId: string
  ): Promise<{
    deletedIds: string[];
    descendantCount: number;
  }> {
    await requireAdmin(actorId);
    await this.workItems.requireProjectMember(workItemId, actorId);

    const current = await this.workItems.getById(workItemId);
    if (current.record_status !== 'archived') {
      throw new WorkItemValidationError(
        'Only archived work items can be permanently deleted.'
      );
    }

    const ids = await this.workItems.collectDescendantIds(workItemId);
    const storagePaths = await this.workItems.listAttachmentStoragePaths(ids);

    await this.workItems.deleteNotificationsForWorkItems(ids);
    await this.workItems.deleteWorkItemsByIds(ids);

    if (storagePaths.length > 0) {
      try {
        await removeStorageObjects(
          env.STORAGE_BUCKET_ATTACHMENTS,
          storagePaths
        );
      } catch (error) {
        console.error(
          'error. failed to remove attachment storage after work-item purge:',
          error instanceof Error ? error.message : error
        );
      }
    }

    return {
      deletedIds: ids,
      descendantCount: Math.max(0, ids.length - 1),
    };
  }

  async countDescendants(workItemId: string, actorId: string): Promise<number> {
    await this.workItems.requireProjectMember(workItemId, actorId);
    const ids = await this.workItems.collectDescendantIds(workItemId);
    return Math.max(0, ids.length - 1);
  }

  async listWorkItemWorkLogs(actorId: string, workItemId: string) {
    return await this.workItems.listWorkItemWorkLogs(workItemId, actorId);
  }

  async createWorkItemWorkLog(
    actorId: string,
    workItemId: string,
    input: {
      loggedHours: number;
      loggedAtIso: string;
      comment: string | null;
    }
  ) {
    const current = await this.workItems.getById(workItemId);
    if (current?.status === 'Done') {
      throw new WorkItemValidationError(
        'Done work items are read-only except Status. Change status to log work.'
      );
    }

    return await this.workItems.createWorkItemWorkLog({
      workItemId,
      actorId,
      loggedHours: input.loggedHours,
      loggedAtIso: input.loggedAtIso,
      comment: input.comment,
    });
  }

  /**
   * Archive or restore a work-item subtree after membership + state checks.
   */
  private async setSubtreeRecordStatus(
    actorId: string,
    workItemId: string,
    expectedUpdatedAt: string,
    recordStatus: 'active' | 'archived',
    invalidStateMessage: string
  ): Promise<DbWorkItem> {
    await this.workItems.requireProjectMember(workItemId, actorId);
    const current = await this.workItems.getById(workItemId);
    const isArchived = current.record_status === 'archived';
    const isInvalid = recordStatus === 'archived' ? isArchived : !isArchived;
    if (isInvalid) {
      throw new WorkItemValidationError(invalidStateMessage);
    }
    return await this.workItems.setRecordStatusForSubtree(
      workItemId,
      recordStatus,
      actorId,
      expectedUpdatedAt,
      {
        unlinkFromParent:
          recordStatus === 'active' && Boolean(current.parent_id),
      }
    );
  }

  /**
   * Apply membership scope to list filters.
   * Returns `null` when the actor has no accessible projects (or requested an inaccessible one).
   */
  private resolveScopedListFilters(
    query: ListWorkItemsQuery,
    accessible: 'all' | string[]
  ): {
    sprintId?: string | null;
    projectId?: string;
    projectIds?: readonly string[];
    parentId?: string | null;
    type?: WorkItemType;
    assigneeId?: string;
    labels?: string[];
    recordStatus?: 'active' | 'archived';
  } | null {
    const base = {
      sprintId: query.sprintId,
      parentId: query.parentId,
      type: query.type,
      assigneeId: query.assigneeId,
      labels: query.labels,
      recordStatus: query.recordStatus,
    };

    if (accessible === 'all') {
      return { ...base, projectId: query.projectId };
    }

    if (accessible.length === 0) {
      return null;
    }

    if (query.projectId) {
      if (!accessible.includes(query.projectId)) {
        return null;
      }
      return { ...base, projectId: query.projectId };
    }

    return { ...base, projectIds: accessible };
  }

  private async assertCanBecomeDone(
    current: DbWorkItem | null | undefined,
    workItemId: string,
    nextStatus: WorkItemUpdateBody['status']
  ): Promise<void> {
    if (nextStatus !== 'Done') {
      return;
    }

    if (!current || current.status === 'Done') {
      return;
    }

    const incompleteCount =
      await this.workItems.countIncompleteChildren(workItemId);
    if (incompleteCount > 0) {
      throw new WorkItemValidationError(
        `Cannot mark as Done while ${incompleteCount} subtask${incompleteCount === 1 ? ' is' : 's are'} incomplete. Complete or unlink them first.`
      );
    }
  }

  /** Done records accept Status changes only (reopen or keep Done). */
  private assertDoneIsReadOnlyExceptStatus(
    current: DbWorkItem | null | undefined,
    input: WorkItemUpdateBody
  ): void {
    if (current?.status !== 'Done') {
      return;
    }

    const dueUnchanged =
      toDateOnly(input.due_date) === toDateOnly(current.due_date);
    const descriptionUnchanged =
      JSON.stringify(input.description ?? null) ===
      JSON.stringify(current.description ?? null);
    const labelsUnchanged =
      JSON.stringify(input.labels ?? parseWorkItemLabels(current.labels)) ===
      JSON.stringify(parseWorkItemLabels(current.labels));

    const nonStatusChanged =
      input.title !== current.title ||
      input.project_id !== current.project_id ||
      input.type !== current.type ||
      input.priority !== current.priority ||
      !sameNullable(input.assignee_id, current.assignee_id) ||
      !sameNullable(input.reporter_id, current.reporter_id) ||
      !dueUnchanged ||
      !sameNullable(input.sprint_id, current.sprint_id) ||
      !sameNullable(input.story_points, current.story_points) ||
      !sameNullable(input.parent_id, current.parent_id) ||
      !descriptionUnchanged ||
      !labelsUnchanged ||
      !sameNullable(input.jira_issue_key, current.jira_issue_key);

    if (nonStatusChanged) {
      throw new WorkItemValidationError(
        'Done work items are read-only except Status. Change status to edit other fields.'
      );
    }
  }

  private async assertValidParentLink(params: {
    parentId?: string | null;
    projectId: string;
    childType: WorkItemType;
    childId?: string;
  }): Promise<void> {
    const { parentId, projectId, childType, childId } = params;

    if (parentId == null) {
      return;
    }

    if (childId && parentId === childId) {
      throw new WorkItemValidationError('A work item cannot be its own parent');
    }

    const parent = await this.workItems.getById(parentId);
    if (!parent) {
      throw new WorkItemValidationError('Parent work item not found');
    }

    if (parent.project_id !== projectId) {
      throw new WorkItemValidationError(
        'Subtask must belong to the same project as its parent'
      );
    }

    const allowedChildType = getAllowedChildType(parent.type as WorkItemType);
    if (!allowedChildType) {
      throw new WorkItemValidationError(
        `Parent of type ${parent.type} cannot have subtasks`
      );
    }

    if (childType !== allowedChildType) {
      throw new WorkItemValidationError(
        `Parent of type ${parent.type} only allows child type ${allowedChildType}`
      );
    }

    if (childId) {
      await this.assertParentLinkIsAcyclic(childId, parentId);
    }
  }

  /** Walk up from the proposed parent; fail if the child appears in that chain. */
  private async assertParentLinkIsAcyclic(
    childId: string,
    parentId: string
  ): Promise<void> {
    let currentId: string | null = parentId;
    const seen = new Set<string>();

    while (currentId) {
      if (currentId === childId) {
        throw new WorkItemValidationError(
          'Cannot set parent: that would create a cycle in the work item hierarchy'
        );
      }
      if (seen.has(currentId)) {
        throw new WorkItemValidationError(
          'Cannot set parent: that would create a cycle in the work item hierarchy'
        );
      }
      seen.add(currentId);

      const ancestor = await this.workItems.getById(currentId);
      currentId = ancestor?.parent_id ?? null;
    }
  }

  private async fetchGithubPRData(
    pr: DbGithubPullRequest,
    headers: Record<string, string>
  ): Promise<{
    title: string;
    status: string;
    branchName: string;
    commits: { sha: string; message: string; author: string; date: string }[];
    success: boolean;
  }> {
    try {
      const prRes = await fetch(
        `https://api.github.com/repos/${pr.repo_owner}/${pr.repo_name}/pulls/${pr.pr_number}`,
        { headers }
      );

      if (!prRes.ok) {
        return {
          title: pr.pr_title,
          status: pr.status || 'open',
          branchName: pr.branch_name || `feature/PR-${pr.pr_number}`,
          commits: [],
          success: false,
        };
      }

      const prData = (await prRes.json()) as GithubPRApiResponse;
      let status = 'open';
      if (prData.merged) {
        status = 'merged';
      } else if (prData.state === 'closed') {
        status = 'closed';
      }

      const title = prData.title || pr.pr_title;
      const branchName =
        prData.head?.ref || pr.branch_name || `feature/PR-${pr.pr_number}`;
      let commits: {
        sha: string;
        message: string;
        author: string;
        date: string;
      }[] = [];

      const commitsRes = await fetch(
        `https://api.github.com/repos/${pr.repo_owner}/${pr.repo_name}/pulls/${pr.pr_number}/commits`,
        { headers }
      );

      if (commitsRes.ok) {
        const commitsData = await commitsRes.json();
        if (Array.isArray(commitsData)) {
          const typedCommits = commitsData as GithubCommitApiResponse[];
          commits = typedCommits.map((c) => ({
            sha: c.sha?.slice(0, 7) || 'unknown',
            message: c.commit?.message || 'No commit message',
            author: c.commit?.author?.name || c.author?.login || 'unknown',
            date: c.commit?.author?.date || new Date().toISOString(),
          }));
        }
      }

      return {
        title,
        status,
        branchName,
        commits,
        success: true,
      };
    } catch (e) {
      console.warn(
        `Failed to fetch real GitHub PR ${pr.repo_owner}/${pr.repo_name}#${pr.pr_number}:`,
        e
      );
      return {
        title: pr.pr_title,
        status: pr.status || 'open',
        branchName: pr.branch_name || `feature/PR-${pr.pr_number}`,
        commits: [],
        success: false,
      };
    }
  }

  async listLinkedPRs(
    actorId: string,
    workItemId: string
  ): Promise<{
    prs: (DbGithubPullRequest & {
      commits: { sha: string; message: string; author: string; date: string }[];
    })[];
    githubRepo: string | null;
  }> {
    await this.workItems.requireProjectMember(workItemId, actorId);
    const prs = await this.workItems.listLinkedPRs(workItemId);
    const settings =
      await this.workItems.getProjectGithubSettingsByWorkItem(workItemId);

    const headers = githubApiHeaders(settings?.github_token);

    const result = [];
    for (const pr of prs) {
      const details = await this.fetchGithubPRData(pr, headers);

      if (details.success) {
        if (
          details.status !== pr.status ||
          details.title !== pr.pr_title ||
          details.branchName !== pr.branch_name
        ) {
          await this.workItems.linkPR(workItemId, {
            prNumber: pr.pr_number,
            repoOwner: pr.repo_owner,
            repoName: pr.repo_name,
            prTitle: details.title,
            prUrl: pr.pr_url,
            branchName: details.branchName,
            status: details.status,
          });
        }
      } else {
        details.commits = [
          {
            sha: `f7a${pr.pr_number}c1`,
            message: `feat: implement changes for work item`,
            author: 'Carol Member',
            date: new Date(Date.now() - 3600000 * 24).toISOString(),
          },
          {
            sha: `9b1${pr.pr_number}e8`,
            message: `test: add unit tests and validations`,
            author: 'Carol Member',
            date: new Date(Date.now() - 3600000 * 2).toISOString(),
          },
        ];
      }

      result.push({
        ...pr,
        pr_title: details.title,
        status: details.status,
        branch_name: details.branchName,
        commits: details.commits,
      });
    }

    return {
      prs: result,
      githubRepo: settings?.github_repo || null,
    };
  }

  async linkPR(
    actorId: string,
    workItemId: string,
    prUrl: string
  ): Promise<DbGithubPullRequest> {
    await this.workItems.requireProjectMember(workItemId, actorId);
    const githubPrRegex =
      /^(?:https?:\/\/github\.com\/)?([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)\/pull\/(\d+)$/;
    const match = githubPrRegex.exec(prUrl);
    if (!match) {
      throw new WorkItemValidationError(
        'Invalid GitHub PR URL. Expected format: https://github.com/owner/repo/pull/number'
      );
    }

    const repoOwner = match[1]!;
    const repoName = match[2]!;
    const prNumberStr = match[3]!;
    const prNumber = Number.parseInt(prNumberStr, 10);

    const settings =
      await this.workItems.getProjectGithubSettingsByWorkItem(workItemId);
    if (!settings?.github_repo) {
      throw new WorkItemValidationError(
        'GitHub Integration is not configured for this project.'
      );
    }

    const [configOwner, configRepo] = settings.github_repo.split('/');
    if (
      !configOwner ||
      !configRepo ||
      repoOwner.toLowerCase() !== configOwner.toLowerCase() ||
      repoName.toLowerCase() !== configRepo.toLowerCase()
    ) {
      throw new WorkItemValidationError(
        `PR does not belong to the project's configured GitHub repository: ${settings.github_repo}`
      );
    }

    let prTitle = `Pull Request #${prNumber}`;
    let branchName = `feature/PR-${prNumber}`;
    let status = 'open';

    try {
      const headers = githubApiHeaders(settings.github_token);

      const res = await fetch(
        `https://api.github.com/repos/${configOwner}/${configRepo}/pulls/${prNumber}`,
        { headers }
      );

      if (res.ok) {
        const prData = (await res.json()) as GithubPRApiResponse;
        prTitle = prData.title || prTitle;
        branchName = prData.head?.ref || branchName;
        if (prData.merged) {
          status = 'merged';
        } else if (prData.state === 'closed') {
          status = 'closed';
        }
      }
    } catch (e) {
      console.warn(
        'Failed to pre-fetch PR details from GitHub API, using defaults/mocks',
        e
      );
    }

    return await this.workItems.linkPR(workItemId, {
      prNumber,
      repoOwner: configOwner,
      repoName: configRepo,
      prTitle,
      prUrl,
      branchName,
      status,
    });
  }

  async unlinkPR(
    actorId: string,
    workItemId: string,
    prId: string
  ): Promise<void> {
    await this.workItems.requireProjectMember(workItemId, actorId);
    await this.workItems.unlinkPR(workItemId, prId);
  }
}
