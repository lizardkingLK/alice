import { beforeEach, describe, expect, it, vi } from 'vitest';

const enqueueGithubWebhookIngest = vi.fn();

vi.mock('@repo/jobs', () => ({
  enqueueGithubWebhookIngest: (...args: unknown[]) =>
    enqueueGithubWebhookIngest(...args),
}));

vi.mock('../../src/config/env', () => ({
  env: {
    GITHUB_APP_WEBHOOK_SECRET: 'test-webhook-secret',
    REDIS_URL: 'redis://localhost:6379',
  },
}));

import { ingestGithubWebhook } from '../../src/routes/api/github/github-webhook.ingest';
import { signGithubWebhookBody } from '../../src/routes/api/github/github-webhook-signature';

describe('ingestGithubWebhook', () => {
  const secret = 'test-webhook-secret';
  const rawBody = Buffer.from(
    JSON.stringify({
      action: 'opened',
      installation: { id: 99 },
      zen: undefined,
    }),
    'utf8'
  );
  const body = JSON.parse(rawBody.toString('utf8')) as unknown;

  beforeEach(() => {
    enqueueGithubWebhookIngest.mockReset();
    enqueueGithubWebhookIngest.mockResolvedValue({
      jobId: 'github-delivery-del-1',
      duplicate: false,
    });
  });

  it('returns 202 and enqueues on a valid signature', async () => {
    const outcome = await ingestGithubWebhook({
      rawBody,
      signatureHeader: signGithubWebhookBody(rawBody, secret),
      deliveryId: 'del-1',
      event: 'pull_request',
      body,
    });

    expect(outcome.status).toBe(202);
    if (outcome.status === 202) {
      expect(outcome.body).toEqual({
        accepted: true,
        jobId: 'github-delivery-del-1',
        duplicate: false,
      });
    }
    expect(enqueueGithubWebhookIngest).toHaveBeenCalledWith(
      'redis://localhost:6379',
      expect.objectContaining({
        deliveryId: 'del-1',
        event: 'pull_request',
        action: 'opened',
        installationId: 99,
        payload: body,
      })
    );
  });

  it('returns 401 when the signature is invalid', async () => {
    const outcome = await ingestGithubWebhook({
      rawBody,
      signatureHeader: 'sha256=deadbeef',
      deliveryId: 'del-1',
      event: 'pull_request',
      body,
    });

    expect(outcome.status).toBe(401);
    expect(enqueueGithubWebhookIngest).not.toHaveBeenCalled();
  });

  it('returns 400 when delivery or event headers are missing', async () => {
    const signed = signGithubWebhookBody(rawBody, secret);

    const missingDelivery = await ingestGithubWebhook({
      rawBody,
      signatureHeader: signed,
      deliveryId: undefined,
      event: 'ping',
      body,
    });
    expect(missingDelivery.status).toBe(400);

    const missingEvent = await ingestGithubWebhook({
      rawBody,
      signatureHeader: signed,
      deliveryId: 'del-1',
      event: undefined,
      body,
    });
    expect(missingEvent.status).toBe(400);
    expect(enqueueGithubWebhookIngest).not.toHaveBeenCalled();
  });
});
