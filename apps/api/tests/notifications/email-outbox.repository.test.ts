vi.hoisted(() => {
  process.env.GITHUB_ACTIONS = 'true';
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  EmailOutboxStatus,
  EmailTemplate,
  NotificationType,
} from '@repo/types/prisma';
import { PrismaEmailOutboxRepository } from '../../src/routes/api/notifications/email-outbox.repository';

const notificationId = '11111111-1111-4111-8111-111111111111';

describe('PrismaEmailOutboxRepository', () => {
  const queryRaw = vi.fn();
  const notificationFindUnique = vi.fn();
  const userFindFirst = vi.fn();
  const outboxUpsert = vi.fn();
  const outboxUpdateMany = vi.fn();
  const client = {
    $queryRaw: queryRaw,
    notifications: { findUnique: notificationFindUnique },
    users: { findFirst: userFindFirst },
    email_outbox: { upsert: outboxUpsert, updateMany: outboxUpdateMany },
  };

  const repository = new PrismaEmailOutboxRepository(client as never);

  beforeEach(() => {
    vi.clearAllMocks();
    notificationFindUnique.mockResolvedValue({
      user_id: 'user-1',
      type: NotificationType.assign,
    });
    userFindFirst.mockResolvedValue({
      id: 'user-1',
      email: 'member@example.com',
      name: 'Taylor',
      notification_email_preference: null,
    });
    outboxUpsert.mockResolvedValue({ id: 'outbox-1' });
    outboxUpdateMany.mockResolvedValue({ count: 1 });
  });

  it('creates an idempotent outbox row from the persisted notification', async () => {
    await expect(
      repository.createForNotification({
        notificationId,
        template: EmailTemplate.work_item_assignment,
        payload: { workItemId: 'work-item-1' },
      })
    ).resolves.toEqual({ id: 'outbox-1' });

    expect(outboxUpsert).toHaveBeenCalledWith({
      where: { notification_id: notificationId },
      update: {},
      create: expect.objectContaining({
        notification_id: notificationId,
        user_id: 'user-1',
        recipient_email: 'member@example.com',
        template: EmailTemplate.work_item_assignment,
        idempotency_key: `work_item_assignment:${notificationId}`,
        payload: {
          workItemId: 'work-item-1',
          recipientName: 'Taylor',
        },
      }),
      select: { id: true },
    });
  });

  it('skips disabled preferences and rejects mismatched templates', async () => {
    userFindFirst.mockResolvedValueOnce({
      id: 'user-1',
      email: 'member@example.com',
      name: 'Taylor',
      notification_email_preference: {
        email_enabled: false,
        work_item_assignment_enabled: true,
        work_item_reassignment_enabled: true,
        work_item_status_change_enabled: true,
        weekly_reports_enabled: true,
      },
    });

    await expect(
      repository.createForNotification({
        notificationId,
        template: EmailTemplate.work_item_assignment,
        payload: {},
      })
    ).resolves.toBeNull();
    expect(outboxUpsert).not.toHaveBeenCalled();

    await expect(
      repository.createForNotification({
        notificationId,
        template: EmailTemplate.work_item_status_change,
        payload: {},
      })
    ).rejects.toThrow('Email template does not match notification type.');
  });

  it('rechecks preferences and the recipient address before delivery', async () => {
    userFindFirst.mockResolvedValueOnce({
      email: 'changed@example.com',
      notification_email_preference: null,
    });

    await expect(
      repository.shouldDeliver({
        id: 'outbox-1',
        notificationId,
        userId: 'user-1',
        recipientEmail: 'member@example.com',
        template: EmailTemplate.work_item_assignment,
        payload: {},
        idempotencyKey: `work_item_assignment:${notificationId}`,
        attemptCount: 0,
        maxAttempts: 8,
      })
    ).resolves.toBe(false);
  });

  it('atomically claims due and expired rows with SKIP LOCKED', async () => {
    const now = new Date('2026-11-11T10:00:00.000Z');
    queryRaw.mockResolvedValue([
      {
        id: 'outbox-1',
        notification_id: notificationId,
        user_id: 'user-1',
        recipient_email: 'member@example.com',
        template: EmailTemplate.work_item_assignment,
        payload: { workItemId: 'work-item-1' },
        idempotency_key: `work_item_assignment:${notificationId}`,
        attempt_count: 1,
        max_attempts: 8,
      },
    ]);

    const claimed = await repository.claimBatch({
      workerId: 'worker-a',
      limit: 25,
      now,
      leaseUntil: new Date('2026-11-11T10:01:00.000Z'),
    });

    const sql = queryRaw.mock.calls[0]![0] as { strings: readonly string[] };
    expect(sql.strings.join('?')).toContain('FOR UPDATE SKIP LOCKED');
    expect(sql.strings.join('?')).toContain('locked_until <');
    expect(claimed[0]).toMatchObject({
      id: 'outbox-1',
      notificationId,
      recipientEmail: 'member@example.com',
      attemptCount: 1,
    });
  });

  it('renews and transitions only rows owned by the worker', async () => {
    const now = new Date('2026-11-11T10:00:00.000Z');
    await repository.renewLease({
      id: 'outbox-1',
      workerId: 'worker-a',
      now,
      leaseUntil: new Date('2026-11-11T10:01:00.000Z'),
    });
    expect(outboxUpdateMany).toHaveBeenLastCalledWith({
      where: {
        id: 'outbox-1',
        status: EmailOutboxStatus.processing,
        locked_by: 'worker-a',
        locked_until: { gt: now },
      },
      data: { locked_until: new Date('2026-11-11T10:01:00.000Z') },
    });

    await repository.markRetry({
      id: 'outbox-1',
      workerId: 'worker-a',
      attemptCount: 2,
      nextAttemptAt: new Date('2026-11-11T10:05:00.000Z'),
      errorCode: 'timeout',
      errorMessage: 'timed out',
    });
    expect(outboxUpdateMany).toHaveBeenLastCalledWith({
      where: {
        id: 'outbox-1',
        status: EmailOutboxStatus.processing,
        locked_by: 'worker-a',
      },
      data: expect.objectContaining({
        status: EmailOutboxStatus.retry,
        attempt_count: 2,
        locked_by: null,
        locked_until: null,
      }),
    });
  });

  it('reports lost ownership when no row is updated', async () => {
    outboxUpdateMany.mockResolvedValue({ count: 0 });
    await expect(
      repository.markSent({
        id: 'outbox-1',
        workerId: 'old-worker',
        sentAt: new Date(),
      })
    ).resolves.toBe(false);
  });
});
