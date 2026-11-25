import { JOB_KINDS } from './job-kinds.js';
import { enqueueJob, type EnqueueJobResult } from './enqueue.js';
import {
  githubSyncPushJobId,
  githubSyncPushPayloadSchema,
  type GithubSyncPushPayload,
} from './payloads/github-sync-push.js';

export async function enqueueGithubSyncPush(
  redisUrl: string,
  rawPayload: GithubSyncPushPayload
): Promise<EnqueueJobResult> {
  const data = githubSyncPushPayloadSchema.parse(rawPayload);
  return enqueueJob(redisUrl, {
    name: JOB_KINDS.githubSyncPush,
    data,
    jobId: githubSyncPushJobId(data.deliveryId),
  });
}
