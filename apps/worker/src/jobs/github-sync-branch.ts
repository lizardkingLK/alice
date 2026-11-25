import {
  emitScDomainEvent,
  githubSyncBranchPayloadSchema,
  mapBranchSyncToDomainEvent,
  type GithubSyncBranchPayload,
} from '@repo/jobs';
import { env } from '../config/env';
import { findProjectsBoundToGithubRepo } from './github/find-bound-projects';
import { resolveWorkItemIdForProject } from './github/resolve-work-item-id';
import { upsertSyncedBranch } from './github/upsert-branch';

async function syncBranchForProject(
  project: { id: string; key: string; repo: string },
  payload: GithubSyncBranchPayload
): Promise<{
  projectId: string;
  workItemId: string | null;
  branchId: string;
}> {
  const [owner, name] = project.repo.split('/');
  const workItemId = await resolveWorkItemIdForProject(
    project.id,
    project.key,
    payload.branchName
  );

  const row = await upsertSyncedBranch({
    projectId: project.id,
    workItemId,
    repoOwner: owner ?? payload.repoOwner,
    repoName: name ?? payload.repoName,
    branchName: payload.branchName,
    headSha: payload.headSha,
    action: payload.action,
  });

  return {
    projectId: project.id,
    workItemId,
    branchId: row.id,
  };
}

export async function handleGithubSyncBranch(
  data: GithubSyncBranchPayload
): Promise<void> {
  const payload = githubSyncBranchPayloadSchema.parse(data);

  const projects = await findProjectsBoundToGithubRepo({
    installationId: payload.installationId,
    repoOwner: payload.repoOwner,
    repoName: payload.repoName,
  });

  if (projects.length === 0) {
    console.log(
      JSON.stringify({
        msg: 'github.sync.branch.skip',
        reason: 'no_bound_project',
        deliveryId: payload.deliveryId,
        repo: `${payload.repoOwner}/${payload.repoName}`,
      })
    );
    return;
  }

  const results = await Promise.all(
    projects.map((project) => syncBranchForProject(project, payload))
  );

  console.log(
    JSON.stringify({
      msg: 'github.sync.branch.applied',
      deliveryId: payload.deliveryId,
      action: payload.action,
      branchName: payload.branchName,
      branches: results.length,
    })
  );

  await Promise.all(
    results.map((row) =>
      emitScDomainEvent(
        mapBranchSyncToDomainEvent({
          payload,
          projectId: row.projectId,
          workItemId: row.workItemId,
          branchId: row.branchId,
        }),
        { redisUrl: env.REDIS_URL }
      )
    )
  );
}
