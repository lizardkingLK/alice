import { JOB_KINDS } from './job-kinds.js';
import { enqueueJob, type EnqueueJobResult } from './enqueue.js';
import {
  githubSyncBranchJobId,
  githubSyncBranchPayloadSchema,
  type GithubSyncBranchPayload,
} from './payloads/github-sync-branch.js';

export async function enqueueGithubSyncBranch(
  redisUrl: string,
  rawPayload: GithubSyncBranchPayload
): Promise<EnqueueJobResult> {
  const data = githubSyncBranchPayloadSchema.parse(rawPayload);
  return enqueueJob(redisUrl, {
    name: JOB_KINDS.githubSyncBranch,
    data,
    jobId: githubSyncBranchJobId(data.deliveryId),
  });
}
