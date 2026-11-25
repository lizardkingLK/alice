import {
  emitScDomainEvent,
  githubSyncPushPayloadSchema,
  mapPushSyncToDomainEvent,
  type GithubSyncPushPayload,
} from '@repo/jobs';
import { env } from '../config/env';
import { findProjectsBoundToGithubRepo } from './github/find-bound-projects';
import { resolveWorkItemIdForProject } from './github/resolve-work-item-id';
import { upsertSyncedBranch } from './github/upsert-branch';
import { upsertSyncedCommits } from './github/upsert-commits';

async function syncPushForProject(
  project: { id: string; key: string; repo: string },
  payload: GithubSyncPushPayload
): Promise<{
  projectId: string;
  workItemId: string | null;
  commits: number;
  branchId: string;
}> {
  const [owner, name] = project.repo.split('/');
  const repoOwner = owner ?? payload.repoOwner;
  const repoName = name ?? payload.repoName;

  const messageTexts = payload.commits.map((commit) => commit.message);
  const workItemId = await resolveWorkItemIdForProject(
    project.id,
    project.key,
    payload.branchName,
    ...messageTexts
  );

  let branchAction: 'create' | 'update' | 'delete' = 'update';
  if (payload.deleted) {
    branchAction = 'delete';
  } else if (payload.created) {
    branchAction = 'create';
  }

  const branch = await upsertSyncedBranch({
    projectId: project.id,
    workItemId,
    repoOwner,
    repoName,
    branchName: payload.branchName,
    headSha: payload.deleted ? null : payload.afterSha,
    action: branchAction,
  });

  const commits = payload.deleted
    ? 0
    : await upsertSyncedCommits({
        projectId: project.id,
        workItemId,
        repoOwner,
        repoName,
        branchName: payload.branchName,
        commits: payload.commits,
      });

  return {
    projectId: project.id,
    workItemId,
    commits,
    branchId: branch.id,
  };
}

export async function handleGithubSyncPush(
  data: GithubSyncPushPayload
): Promise<void> {
  const payload = githubSyncPushPayloadSchema.parse(data);

  const projects = await findProjectsBoundToGithubRepo({
    installationId: payload.installationId,
    repoOwner: payload.repoOwner,
    repoName: payload.repoName,
  });

  if (projects.length === 0) {
    console.log(
      JSON.stringify({
        msg: 'github.sync.push.skip',
        reason: 'no_bound_project',
        deliveryId: payload.deliveryId,
        repo: `${payload.repoOwner}/${payload.repoName}`,
      })
    );
    return;
  }

  const results = await Promise.all(
    projects.map((project) => syncPushForProject(project, payload))
  );

  console.log(
    JSON.stringify({
      msg: 'github.sync.push.applied',
      deliveryId: payload.deliveryId,
      branchName: payload.branchName,
      deleted: payload.deleted,
      projects: projects.length,
      commits: results.reduce((sum, row) => sum + row.commits, 0),
    })
  );

  await Promise.all(
    results.map((row) =>
      emitScDomainEvent(
        mapPushSyncToDomainEvent({
          payload,
          projectId: row.projectId,
          workItemId: row.workItemId,
          branchId: row.branchId,
          commitCount: row.commits,
        }),
        { redisUrl: env.REDIS_URL }
      )
    )
  );
}
