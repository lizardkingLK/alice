import { JOB_KINDS } from './job-kinds.js';
import { enqueueJob, type EnqueueJobResult } from './enqueue.js';
import {
  githubDeliveryJobId,
  githubWebhookIngestPayloadSchema,
  type GithubWebhookIngestPayload,
} from './payloads/github-webhook.js';

export type EnqueueGithubWebhookResult = EnqueueJobResult;

/**
 * Enqueue a verified GitHub webhook for worker ingest.
 * Duplicate `deliveryId` → `{ duplicate: true }` (idempotent 202).
 */
export async function enqueueGithubWebhookIngest(
  redisUrl: string,
  rawPayload: GithubWebhookIngestPayload
): Promise<EnqueueGithubWebhookResult> {
  const data = githubWebhookIngestPayloadSchema.parse(rawPayload);
  return enqueueJob(redisUrl, {
    name: JOB_KINDS.githubWebhookIngest,
    data,
    jobId: githubDeliveryJobId(data.deliveryId),
  });
}
