import {
  enqueueGithubSyncBranch,
  enqueueGithubSyncPullRequest,
  enqueueGithubSyncPush,
  githubWebhookIngestPayloadSchema,
  type GithubWebhookIngestPayload,
} from '@repo/jobs';
import { env } from '../config/env';
import { parseBranchSyncPayload } from './github/parse-branch-event';
import { parsePullRequestSyncPayload } from './github/parse-pull-request-event';
import { parsePushSyncPayload } from './github/parse-push-event';

/**
 * After API HMAC verify: fan out domain sync jobs for PR / push / branch.
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

  if (!env.REDIS_URL) {
    throw new Error('REDIS_URL is required to fan out github.sync jobs');
  }

  if (payload.event === 'pull_request') {
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
    const result = await enqueueGithubSyncPullRequest(
      env.REDIS_URL,
      syncPayload
    );
    console.log(
      JSON.stringify({
        msg: 'github.webhook.ingest.enqueued',
        kind: 'github.sync.pull_request',
        jobId: result.jobId,
        duplicate: result.duplicate,
        deliveryId: payload.deliveryId,
      })
    );
    return;
  }

  if (payload.event === 'push') {
    const syncPayload = parsePushSyncPayload(payload);
    if (!syncPayload) {
      console.log(
        JSON.stringify({
          msg: 'github.webhook.ingest.skip',
          reason: 'push_not_branch_or_incomplete',
          deliveryId: payload.deliveryId,
        })
      );
      return;
    }
    const result = await enqueueGithubSyncPush(env.REDIS_URL, syncPayload);
    console.log(
      JSON.stringify({
        msg: 'github.webhook.ingest.enqueued',
        kind: 'github.sync.push',
        jobId: result.jobId,
        duplicate: result.duplicate,
        deliveryId: payload.deliveryId,
      })
    );
    return;
  }

  if (payload.event === 'create' || payload.event === 'delete') {
    const syncPayload = parseBranchSyncPayload(payload);
    if (!syncPayload) {
      console.log(
        JSON.stringify({
          msg: 'github.webhook.ingest.skip',
          reason: 'ref_not_branch_or_incomplete',
          deliveryId: payload.deliveryId,
          event: payload.event,
        })
      );
      return;
    }
    const result = await enqueueGithubSyncBranch(env.REDIS_URL, syncPayload);
    console.log(
      JSON.stringify({
        msg: 'github.webhook.ingest.enqueued',
        kind: 'github.sync.branch',
        jobId: result.jobId,
        duplicate: result.duplicate,
        deliveryId: payload.deliveryId,
      })
    );
    return;
  }

  console.log(
    JSON.stringify({
      msg: 'github.webhook.ingest.skip',
      reason: 'event_not_synced_yet',
      event: payload.event,
      deliveryId: payload.deliveryId,
    })
  );
}
