import {
  githubSyncPullRequestPayloadSchema,
  type GithubSyncPullRequestPayload,
} from '@repo/jobs';
import { prisma } from '../lib/prisma';
import {
  findProjectsBoundToGithubRepo,
  type BoundGithubProject,
} from './github/find-bound-projects';
import { extractWorkItemCandidates } from './github/resolve-work-item-from-branch';
import {
  refreshExistingLinkedPullRequests,
  upsertLinkedPullRequest,
  type UpsertLinkedPrResult,
} from './github/upsert-linked-pr';

async function resolveWorkItemId(
  projectId: string,
  projectKey: string,
  payload: GithubSyncPullRequestPayload
): Promise<string | null> {
  const { slugs, ids } = extractWorkItemCandidates(
    projectKey,
    payload.branchName,
    payload.prTitle
  );

  if (ids.length > 0) {
    const byId = await prisma.work_items.findFirst({
      where: {
        project_id: projectId,
        record_status: 'active',
        id: { in: ids },
      },
      select: { id: true },
    });
    if (byId) {
      return byId.id;
    }
  }

  if (slugs.length === 0) {
    return null;
  }

  const bySlug = await prisma.work_items.findFirst({
    where: {
      project_id: projectId,
      record_status: 'active',
      slug: { in: slugs, mode: 'insensitive' },
    },
    select: { id: true },
  });

  return bySlug?.id ?? null;
}

type AutoLinkAttempt = {
  projectKey: string;
  result: UpsertLinkedPrResult | null;
};

async function tryAutoLinkProject(
  project: BoundGithubProject,
  payload: GithubSyncPullRequestPayload
): Promise<AutoLinkAttempt> {
  const workItemId = await resolveWorkItemId(project.id, project.key, payload);
  if (!workItemId) {
    return { projectKey: project.key, result: null };
  }

  const [owner, name] = project.repo.split('/');
  const result = await upsertLinkedPullRequest(workItemId, payload, {
    owner: owner ?? payload.repoOwner,
    name: name ?? payload.repoName,
  });

  return { projectKey: project.key, result };
}

/**
 * Sync a GitHub PR into `version_control_pull_requests` when a work item
 * can be resolved (existing link refresh, or auto-link from branch/title).
 */
export async function handleGithubSyncPullRequest(
  data: GithubSyncPullRequestPayload
): Promise<void> {
  const payload = githubSyncPullRequestPayloadSchema.parse(data);

  const refreshed = await refreshExistingLinkedPullRequests(payload);
  if (refreshed.length > 0) {
    console.log(
      JSON.stringify({
        msg: 'github.sync.pull_request.refreshed',
        deliveryId: payload.deliveryId,
        prNumber: payload.prNumber,
        links: refreshed.length,
      })
    );
    return;
  }

  const projects = await findProjectsBoundToGithubRepo({
    installationId: payload.installationId,
    repoOwner: payload.repoOwner,
    repoName: payload.repoName,
  });

  if (projects.length === 0) {
    console.log(
      JSON.stringify({
        msg: 'github.sync.pull_request.skip',
        reason: 'no_bound_project',
        deliveryId: payload.deliveryId,
        installationId: payload.installationId,
        repo: `${payload.repoOwner}/${payload.repoName}`,
      })
    );
    return;
  }

  const attempts = await Promise.all(
    projects.map((project) => tryAutoLinkProject(project, payload))
  );
  const linked = attempts.flatMap((attempt) => {
    if (!attempt.result) {
      return [];
    }
    return [{ projectKey: attempt.projectKey, result: attempt.result }];
  });

  for (const { projectKey, result } of linked) {
    console.log(
      JSON.stringify({
        msg: 'github.sync.pull_request.linked',
        deliveryId: payload.deliveryId,
        workItemId: result.workItemId,
        prId: result.prId,
        created: result.created,
        projectKey,
      })
    );
  }

  if (linked.length === 0) {
    console.log(
      JSON.stringify({
        msg: 'github.sync.pull_request.skip',
        reason: 'work_item_unresolved',
        deliveryId: payload.deliveryId,
        branchName: payload.branchName,
        projects: projects.map((project) => project.key),
      })
    );
  }
}
