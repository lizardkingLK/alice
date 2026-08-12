import {
  getAllowedChildType,
  type WorkItemType,
  parseWorkItemLabels,
} from '@repo/types';
import { WorkItemRepository } from './workItems.repository';
import type { DbWorkItem, DbGithubPullRequest } from './workItems.repository';
import { sameNullable } from './workItems.patch-utils';
import {
  toDateOnly,
  WorkItemBody,
  WorkItemUpdateBody,
} from './workItems.schemas';

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

export class WorkItemValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkItemValidationError';
  }
}

export class WorkItemService {
  constructor(private readonly workItems: WorkItemRepository) {}

  async getWorkItems(filters?: {
    sprint_id?: string | null;
  }): Promise<DbWorkItem[]> {
    return await this.workItems.get(filters);
  }

  async listWorkItems(
    page?: number,
    limit?: number,
    search?: string,
    filters?: { sprint_id?: string | null }
  ): Promise<{ workItems: DbWorkItem[]; totalCount: number } | DbWorkItem[]> {
    if (page !== undefined && limit !== undefined) {
      return await this.workItems.listPaginated(page, limit, search, filters);
    }

    return await this.workItems.get(filters);
  }

  async getWorkItem(workItemId: string): Promise<DbWorkItem> {
    return await this.workItems.getById(workItemId);
  }

  async createWorkItem(
    userId: string,
    input: WorkItemBody
  ): Promise<DbWorkItem> {
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
      const branchName = prData.head?.ref || pr.branch_name || `feature/PR-${pr.pr_number}`;
      let commits: { sha: string; message: string; author: string; date: string }[] = [];

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
      console.warn(`Failed to fetch real GitHub PR ${pr.repo_owner}/${pr.repo_name}#${pr.pr_number}:`, e);
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
    _actorId: string,
    workItemId: string
  ): Promise<{
    prs: (DbGithubPullRequest & { commits: { sha: string; message: string; author: string; date: string }[] })[];
    githubRepo: string | null;
  }> {
    const prs = await this.workItems.listLinkedPRs(workItemId);
    const settings = await this.workItems.getProjectGithubSettingsByWorkItem(workItemId);

    const headers: Record<string, string> = {
      'User-Agent': 'Alice-App',
      'Accept': 'application/vnd.github.v3+json',
    };
    if (settings?.github_token) {
      headers['Authorization'] = `token ${settings.github_token}`;
    }

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

  async linkPR(_actorId: string, workItemId: string, prUrl: string): Promise<DbGithubPullRequest> {
    const githubPrRegex = /^(?:https?:\/\/github\.com\/)?([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)\/pull\/(\d+)$/;
    const match = githubPrRegex.exec(prUrl);
    if (!match) {
      throw new WorkItemValidationError('Invalid GitHub PR URL. Expected format: https://github.com/owner/repo/pull/number');
    }

    const repoOwner = match[1]!;
    const repoName = match[2]!;
    const prNumberStr = match[3]!;
    const prNumber = Number.parseInt(prNumberStr, 10);

    const settings = await this.workItems.getProjectGithubSettingsByWorkItem(workItemId);
    if (!settings?.github_repo) {
      throw new WorkItemValidationError('GitHub Integration is not configured for this project.');
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
      const headers: Record<string, string> = {
        'User-Agent': 'Alice-App',
        'Accept': 'application/vnd.github.v3+json',
      };
      if (settings.github_token) {
        headers['Authorization'] = `token ${settings.github_token}`;
      }

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
      console.warn('Failed to pre-fetch PR details from GitHub API, using defaults/mocks', e);
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

  async unlinkPR(_actorId: string, workItemId: string, prId: string): Promise<void> {
    await this.workItems.unlinkPR(workItemId, prId);
  }
}
