import {
  enqueueGithubSyncPullRequest,
  githubWebhookIngestPayloadSchema,
  type GithubWebhookIngestPayload,
} from '@repo/jobs';
import { env } from '../config/env';
import { parsePullRequestSyncPayload } from './github/parse-pull-request-event';

/**
 * After API HMAC verify: fan out domain sync jobs. PR sync is live;
 * push/branch wait on commit/branch tables.
 */
export async function handleGithubWebhookIngest(
  data: GithubWebhookIngestPayload
): Promise<void> {
  const payload = githubWebhookIngestPayloadSchema.parse(data);

  console.log(
    JSON.stringify({
      msg: 'github.webhook.ingest',
      deliveryId: payload.deliveryId,
      event: payload.event,
      action: payload.action ?? null,
      installationId: payload.installationId ?? null,
    })
  );

  if (payload.event === 'ping') {
    return;
  }

  if (payload.event !== 'pull_request') {
    console.log(
      JSON.stringify({
        msg: 'github.webhook.ingest.skip',
        reason: 'event_not_synced_yet',
        event: payload.event,
        deliveryId: payload.deliveryId,
      })
    );
    return;
  }

  if (!env.REDIS_URL) {
    throw new Error('REDIS_URL is required to fan out github.sync jobs');
  }

  const syncPayload = parsePullRequestSyncPayload(payload);
  if (!syncPayload) {
    console.warn(
      JSON.stringify({
        msg: 'github.webhook.ingest.skip',
        reason: 'pull_request_payload_incomplete',
        deliveryId: payload.deliveryId,
      })
    );
    return;
  }

  const result = await enqueueGithubSyncPullRequest(env.REDIS_URL, syncPayload);
  console.log(
    JSON.stringify({
      msg: 'github.webhook.ingest.enqueued',
      kind: 'github.sync.pull_request',
      jobId: result.jobId,
      duplicate: result.duplicate,
      deliveryId: payload.deliveryId,
    })
  );
}
