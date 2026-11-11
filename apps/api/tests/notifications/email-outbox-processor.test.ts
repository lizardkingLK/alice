import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EmailTransportError } from '../../src/lib/email/email-transport';
import {
  EmailOutboxProcessor,
  type ClaimedEmailOutboxItem,
  type EmailOutboxRepository,
} from '../../src/routes/api/notifications/email-outbox-processor';

const NOW = new Date('2026-11-11T10:00:00.000Z');
const item: ClaimedEmailOutboxItem = {
  id: 'outbox-1',
  userId: 'user-1',
  template: 'work_item_assignment',
  payload: {},
  attemptCount: 0,
  maxAttempts: 3,
};

describe('EmailOutboxProcessor', () => {
  const claimBatch = vi.fn();
  const shouldDeliver = vi.fn();
  const renewLease = vi.fn();
  const markSent = vi.fn();
  const markRetry = vi.fn();
  const markCancelled = vi.fn();
  const markDead = vi.fn();
  const send = vi.fn();
  const build = vi.fn();
  const repository = {
    claimBatch,
    renewLease,
    shouldDeliver,
    markSent,
    markRetry,
    markCancelled,
    markDead,
  } as unknown as EmailOutboxRepository;

  function processor(workerId = 'worker-a') {
    return new EmailOutboxProcessor(
      repository,
      { send },
      { build },
      {
        workerId,
        batchSize: 10,
        leaseDurationMs: 30_000,
        now: () => NOW,
      }
    );
  }

  beforeEach(() => {
    vi.clearAllMocks();
    claimBatch.mockResolvedValue([item]);
    renewLease.mockResolvedValue(true);
    shouldDeliver.mockResolvedValue(true);
    markSent.mockResolvedValue(true);
    markRetry.mockResolvedValue(true);
    markCancelled.mockResolvedValue(true);
    markDead.mockResolvedValue(true);
    send.mockResolvedValue(undefined);
    build.mockReturnValue({
      to: 'member@example.com',
      subject: 'Assigned',
      text: 'Assigned',
      html: '<p>Assigned</p>',
      idempotencyKey: 'assignment:outbox-1',
    });
  });

  it('claims with a lease and marks successful delivery with its owner', async () => {
    const result = await processor().processBatch();

    expect(claimBatch).toHaveBeenCalledWith({
      workerId: 'worker-a',
      limit: 10,
      now: NOW,
      leaseUntil: new Date('2026-11-11T10:00:30.000Z'),
    });
    expect(markSent).toHaveBeenCalledWith({
      id: 'outbox-1',
      workerId: 'worker-a',
      sentAt: NOW,
    });
    expect(renewLease).toHaveBeenCalledWith({
      id: 'outbox-1',
      workerId: 'worker-a',
      now: NOW,
      leaseUntil: new Date('2026-11-11T10:00:30.000Z'),
    });
    expect(result.sent).toBe(1);
  });

  it('does not send duplicate rows returned in one claim', async () => {
    claimBatch.mockResolvedValue([item, item]);

    const result = await processor().processBatch();

    expect(send).toHaveBeenCalledOnce();
    expect(result).toMatchObject({ duplicateClaims: 1, sent: 1 });
  });

  it('cancels delivery when current preferences disable it', async () => {
    shouldDeliver.mockResolvedValue(false);

    const result = await processor().processBatch();

    expect(send).not.toHaveBeenCalled();
    expect(markCancelled).toHaveBeenCalledWith({
      id: 'outbox-1',
      workerId: 'worker-a',
      cancelledAt: NOW,
      reason: 'email_preference_disabled',
    });
    expect(result.cancelled).toBe(1);
  });

  it('retries transient failures with backoff', async () => {
    send.mockRejectedValue(
      new EmailTransportError('rate limited', { kind: 'http', status: 429 })
    );

    const result = await processor().processBatch();

    expect(markRetry).toHaveBeenCalledWith({
      id: 'outbox-1',
      workerId: 'worker-a',
      attemptCount: 1,
      nextAttemptAt: new Date('2026-11-11T10:01:00.000Z'),
      errorCode: 'http_429',
      errorMessage: 'rate limited',
    });
    expect(result.retried).toBe(1);
  });

  it('dead-letters permanent and exhausted failures', async () => {
    send.mockRejectedValue(
      new EmailTransportError('invalid recipient', {
        kind: 'http',
        status: 422,
      })
    );
    await processor().processBatch();
    expect(markDead).toHaveBeenLastCalledWith(
      expect.objectContaining({ errorCode: 'http_422', attemptCount: 1 })
    );

    claimBatch.mockResolvedValue([{ ...item, attemptCount: 2 }]);
    send.mockRejectedValue(new Error('network down'));
    await processor().processBatch();
    expect(markDead).toHaveBeenLastCalledWith(
      expect.objectContaining({
        errorCode: 'attempts_exhausted',
        attemptCount: 3,
      })
    );
  });

  it('reports lease loss instead of claiming a state transition', async () => {
    markSent.mockResolvedValue(false);

    const result = await processor('expired-owner').processBatch();

    expect(markSent).toHaveBeenCalledWith(
      expect.objectContaining({ workerId: 'expired-owner' })
    );
    expect(result).toMatchObject({ sent: 0, leaseLost: 1 });
  });

  it('does not send after ownership of an expired lease was lost', async () => {
    renewLease.mockResolvedValue(false);

    const result = await processor('old-worker').processBatch();

    expect(send).not.toHaveBeenCalled();
    expect(markSent).not.toHaveBeenCalled();
    expect(result.leaseLost).toBe(1);
  });

  it('allows an expired lease to be reclaimed by the repository contract', async () => {
    let lockedUntil = new Date('2026-11-11T09:59:59.000Z');
    claimBatch.mockImplementation(
      async ({
        now,
        leaseUntil,
      }: Parameters<EmailOutboxRepository['claimBatch']>[0]) => {
        if (lockedUntil > now) return [];
        lockedUntil = leaseUntil;
        return [item];
      }
    );

    const result = await processor('recovery-worker').processBatch();

    expect(result.claimed).toBe(1);
    expect(markSent).toHaveBeenCalledWith(
      expect.objectContaining({ workerId: 'recovery-worker' })
    );
  });
});
