import { enqueueGithubWebhookIngest } from '@repo/jobs';
import { env } from '../../../config/env';
import { verifyGithubWebhookSignature } from './github-webhook-signature';

export type GithubWebhookIngestInput = {
  rawBody: Buffer;
  signatureHeader: string | undefined;
  deliveryId: string | undefined;
  event: string | undefined;
  /** Parsed JSON body (already validated as object by Express). */
  body: unknown;
};

export type GithubWebhookIngestOutcome =
  | { status: 202; body: { accepted: true; jobId: string; duplicate: boolean } }
  | { status: 400; body: { error: string } }
  | { status: 401; body: { error: string } }
  | { status: 503; body: { error: string } };

function readInstallationId(body: unknown): number | undefined {
  if (!body || typeof body !== 'object') {
    return undefined;
  }
  const installation = (body as { installation?: { id?: unknown } })
    .installation;
  if (!installation || typeof installation !== 'object') {
    return undefined;
  }
  const id = installation.id;
  return typeof id === 'number' && Number.isInteger(id) && id > 0
    ? id
    : undefined;
}

function readAction(body: unknown): string | undefined {
  if (!body || typeof body !== 'object') {
    return undefined;
  }
  const action = (body as { action?: unknown }).action;
  return typeof action === 'string' && action.length > 0 ? action : undefined;
}

/**
 * Verify HMAC + enqueue `github.webhook.ingest`. Returns an HTTP outcome
 * (no Express types) so unit tests can drive it without a server.
 */
export async function ingestGithubWebhook(
  input: GithubWebhookIngestInput
): Promise<GithubWebhookIngestOutcome> {
  const secret = env.GITHUB_APP_WEBHOOK_SECRET;
  if (!secret) {
    return {
      status: 503,
      body: { error: 'GitHub webhook secret is not configured' },
    };
  }

  const redisUrl = env.REDIS_URL;
  if (!redisUrl) {
    return {
      status: 503,
      body: { error: 'Job queue is not configured' },
    };
  }

  if (!input.deliveryId) {
    return {
      status: 400,
      body: { error: 'Missing X-GitHub-Delivery header' },
    };
  }

  if (!input.event) {
    return {
      status: 400,
      body: { error: 'Missing X-GitHub-Event header' },
    };
  }

  if (
    !verifyGithubWebhookSignature(input.rawBody, input.signatureHeader, secret)
  ) {
    return {
      status: 401,
      body: { error: 'Invalid webhook signature' },
    };
  }

  const result = await enqueueGithubWebhookIngest(redisUrl, {
    deliveryId: input.deliveryId,
    event: input.event,
    action: readAction(input.body),
    installationId: readInstallationId(input.body),
    receivedAt: new Date().toISOString(),
    payload: input.body,
  });

  return {
    status: 202,
    body: {
      accepted: true,
      jobId: result.jobId,
      duplicate: result.duplicate,
    },
  };
}
