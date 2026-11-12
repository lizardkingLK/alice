import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EmailTemplate } from '@repo/types/prisma';
import { NotificationEmailReconciler } from '../../src/routes/api/notifications/notification-email-reconciler';

const validEvent = {
  notificationId: '11111111-1111-4111-8111-111111111111',
  version: 1,
  template: EmailTemplate.work_item_assignment,
  payload: {
    actorName: 'Alex',
    workItemId: 'work-item-1',
    workItemTitle: 'Repair delivery',
  },
};

describe('NotificationEmailReconciler', () => {
  const findMissingNotificationEmailEvents = vi.fn();
  const createForNotification = vi.fn();
  const createInvalidEventTerminal = vi.fn();
  const repository = {
    findMissingNotificationEmailEvents,
    createForNotification,
    createInvalidEventTerminal,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    findMissingNotificationEmailEvents.mockResolvedValue([validEvent]);
    createForNotification.mockResolvedValue({ id: 'outbox-1' });
  });

  it('recovers a valid immutable snapshot with a bounded query', async () => {
    const now = new Date('2026-11-12T01:00:00.000Z');
    const reconciler = new NotificationEmailReconciler(repository as never, {
      batchSize: 20,
    });
    await expect(reconciler.reconcile(now)).resolves.toEqual({
      checked: 1,
      recovered: 1,
      terminal: 0,
      skipped: 0,
      failed: 0,
    });
    expect(findMissingNotificationEmailEvents).toHaveBeenCalledWith({
      now,
      limit: 20,
    });
    expect(createForNotification).toHaveBeenCalledWith({
      notificationId: validEvent.notificationId,
      template: validEvent.template,
      payload: validEvent.payload,
    });
  });

  it('records invalid snapshots terminally', async () => {
    const invalid = { ...validEvent, payload: {} };
    findMissingNotificationEmailEvents.mockResolvedValue([invalid]);
    createInvalidEventTerminal.mockResolvedValue(true);
    await expect(
      new NotificationEmailReconciler(repository as never).reconcile()
    ).resolves.toMatchObject({ terminal: 1, recovered: 0 });
    expect(createInvalidEventTerminal).toHaveBeenCalledWith(invalid);
    expect(createForNotification).not.toHaveBeenCalled();
  });

  it('skips events whose notifications or recipients disappeared', async () => {
    createForNotification.mockResolvedValue(null);
    await expect(
      new NotificationEmailReconciler(repository as never).reconcile()
    ).resolves.toMatchObject({ skipped: 1, recovered: 0 });
  });

  it('continues after a per-event failure so a later run can retry it', async () => {
    findMissingNotificationEmailEvents.mockResolvedValue([
      validEvent,
      { ...validEvent, notificationId: '22222222-2222-4222-8222-222222222222' },
    ]);
    createForNotification
      .mockRejectedValueOnce(new Error('database unavailable'))
      .mockResolvedValueOnce({ id: 'outbox-2' });
    await expect(
      new NotificationEmailReconciler(repository as never).reconcile()
    ).resolves.toEqual({
      checked: 2,
      recovered: 1,
      terminal: 0,
      skipped: 0,
      failed: 1,
    });
  });

  it('continues when persisting an invalid-event terminal record fails', async () => {
    const invalid = { ...validEvent, payload: {} };
    const later = {
      ...validEvent,
      notificationId: '22222222-2222-4222-8222-222222222222',
    };
    findMissingNotificationEmailEvents.mockResolvedValue([invalid, later]);
    createInvalidEventTerminal.mockRejectedValue(
      new Error('database unavailable')
    );

    await expect(
      new NotificationEmailReconciler(repository as never).reconcile()
    ).resolves.toEqual({
      checked: 2,
      recovered: 1,
      terminal: 0,
      skipped: 0,
      failed: 1,
    });
    expect(createForNotification).toHaveBeenCalledWith({
      notificationId: later.notificationId,
      template: later.template,
      payload: later.payload,
    });
  });
});
