import { describe, expect, it } from 'vitest';
import {
  githubDeliveryJobId,
  githubWebhookIngestPayloadSchema,
} from '../src/payloads/github-webhook';

describe('github webhook ingest payload', () => {
  it('builds a stable BullMQ job id from the delivery id', () => {
    expect(githubDeliveryJobId('abc-123')).toBe('github-delivery-abc-123');
  });

  it('accepts a minimal ingest payload', () => {
    const parsed = githubWebhookIngestPayloadSchema.parse({
      deliveryId: 'd1',
      event: 'ping',
      receivedAt: '2026-01-01T00:00:00.000Z',
      payload: { zen: 'Keep it logically awesome.' },
    });

    expect(parsed.event).toBe('ping');
    expect(parsed.action).toBeUndefined();
    expect(parsed.installationId).toBeUndefined();
  });

  it('rejects an empty delivery id', () => {
    expect(() =>
      githubWebhookIngestPayloadSchema.parse({
        deliveryId: '',
        event: 'push',
        receivedAt: '2026-01-01T00:00:00.000Z',
        payload: {},
      })
    ).toThrow();
  });
});
