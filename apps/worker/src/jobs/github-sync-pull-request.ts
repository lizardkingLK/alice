import {
  emitScDomainEvent,
  githubSyncPullRequestPayloadSchema,
  mapPullRequestSyncToDomainEvent,
  type GithubSyncPullRequestPayload,
} from '@repo/jobs';
import { env } from '../config/env';
import {
  findProjectsBoundToGithubRepo,
  type BoundGithubProject,
} from './github/find-bound-projects';
import { resolveWorkItemIdForProject } from './github/resolve-work-item-id';
import {
  refreshExistingLinkedPullRequests,
  upsertLinkedPullRequest,
  type UpsertLinkedPrResult,
} from './github/upsert-linked-pr';

type AutoLinkAttempt = {
  projectId: string;
  projectKey: string;
  result: UpsertLinkedPrResult | null;
};

async function tryAutoLinkProject(
  project: BoundGithubProject,
  payload: GithubSyncPullRequestPayload
): Promise<AutoLinkAttempt> {
  const workItemId = await resolveWorkItemIdForProject(
    project.id,
    project.key,
    payload.branchName,
    payload.prTitle
  );
  if (!workItemId) {
    return { projectId: project.id, projectKey: project.key, result: null };
  }

  const [owner, name] = project.repo.split('/');
  const result = await upsertLinkedPullRequest(workItemId, payload, {
    owner: owner ?? payload.repoOwner,
    name: name ?? payload.repoName,
  });

  return { projectId: project.id, projectKey: project.key, result };
}

async function emitPrEvents(
  payload: GithubSyncPullRequestPayload,
  links: Array<{
    projectId?: string;
    workItemId: string;
    prId: string;
  }>
): Promise<void> {
  await Promise.all(
    links.map((link) =>
      emitScDomainEvent(
        mapPullRequestSyncToDomainEvent({
          payload,
          projectId: link.projectId,
          workItemId: link.workItemId,
          prId: link.prId,
        }),
        { redisUrl: env.REDIS_URL }
      )
    )
  );
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
    await emitPrEvents(payload, refreshed);
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
    return [
      {
        projectId: attempt.projectId,
        projectKey: attempt.projectKey,
        result: attempt.result,
      },
    ];
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
    return;
  }

  await emitPrEvents(
    payload,
    linked.map(({ projectId, result }) => ({
      projectId,
      workItemId: result.workItemId,
      prId: result.prId,
    }))
  );
}
