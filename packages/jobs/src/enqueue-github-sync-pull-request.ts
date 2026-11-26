import { JOB_KINDS } from './job-kinds.js';
import { enqueueJob, type EnqueueJobResult } from './enqueue.js';
import {
  githubSyncPullRequestJobId,
  githubSyncPullRequestPayloadSchema,
  type GithubSyncPullRequestPayload,
} from './payloads/github-sync-pull-request.js';

export async function enqueueGithubSyncPullRequest(
  redisUrl: string,
  rawPayload: GithubSyncPullRequestPayload
): Promise<EnqueueJobResult> {
  const data = githubSyncPullRequestPayloadSchema.parse(rawPayload);
  return enqueueJob(redisUrl, {
    name: JOB_KINDS.githubSyncPullRequest,
    data,
    jobId: githubSyncPullRequestJobId(data.deliveryId),
  });
}
