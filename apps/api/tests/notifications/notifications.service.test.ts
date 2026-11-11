import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  NotificationsService,
  READ_NOTIFICATION_RETENTION_DAYS,
} from '../../src/routes/api/notifications/notifications.service';
import type { NotificationsRepository } from '../../src/routes/api/notifications/notifications.repository';

describe('NotificationsService.createWorkItemMutationNotifications', () => {
  const getUserName = vi.fn();
  const findAuthorizedProjectRecipientIds = vi.fn();
  const insertMany = vi.fn();
  const notificationsRepository = {
    getUserName,
    findAuthorizedProjectRecipientIds,
    insertMany,
  } as unknown as NotificationsRepository;
  const service = new NotificationsService(notificationsRepository);
  const actorId = 'actor';
  const baseAfter = {
    id: 'work-item',
    project_id: 'project',
    title: 'Fix notifications',
    assignee_id: 'assignee',
    reporter_id: 'reporter',
    created_by: 'creator',
    status: 'InProgress',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    getUserName.mockResolvedValue('Alex');
    findAuthorizedProjectRecipientIds.mockImplementation(
      async (_projectId: string, userIds: string[]) => userIds
    );
    insertMany.mockResolvedValue(undefined);
  });

  it('notifies the authorized assignee after creation', async () => {
    await service.createWorkItemMutationNotifications({
      actorId,
      after: baseAfter,
    });

    expect(insertMany).toHaveBeenCalledWith([
      expect.objectContaining({
        user_id: 'assignee',
        type: 'assign',
        related_item_id: 'work-item',
      }),
    ]);
  });

  it('creates typed status notifications once per assignee/reporter', async () => {
    await service.createWorkItemMutationNotifications({
      actorId,
      before: {
        ...baseAfter,
        assignee_id: 'same-user',
        reporter_id: 'same-user',
        status: 'ToDo',
      },
      after: {
        ...baseAfter,
        assignee_id: 'same-user',
        reporter_id: 'same-user',
      },
    });

    const inserted = insertMany.mock.calls[0]![0];
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({
      user_id: 'same-user',
      type: 'status_change',
    });
  });

  it('notifies both sides of a reassignment without duplicate recipients', async () => {
    await service.createWorkItemMutationNotifications({
      actorId,
      before: {
        ...baseAfter,
        assignee_id: 'previous',
        reporter_id: 'previous',
        status: 'ToDo',
      },
      after: baseAfter,
    });

    const inserted = insertMany.mock.calls[0]![0] as Array<{
      user_id: string;
      type: string;
      message: string;
    }>;
    expect(inserted.map((item) => item.user_id).sort()).toEqual([
      'assignee',
      'previous',
      'reporter',
    ]);
    expect(new Set(inserted.map((item) => item.user_id)).size).toBe(
      inserted.length
    );
    expect(inserted.find((item) => item.user_id === 'previous')).toMatchObject({
      type: 'assign',
      message: expect.stringContaining('reassigned'),
    });
  });

  it('skips unchanged values and the actor', async () => {
    await service.createWorkItemMutationNotifications({
      actorId,
      before: { ...baseAfter, assignee_id: actorId },
      after: { ...baseAfter, assignee_id: actorId },
    });

    expect(findAuthorizedProjectRecipientIds).toHaveBeenCalledWith(
      'project',
      []
    );
    expect(insertMany).toHaveBeenCalledWith([]);
  });

  it('persists only recipients authorized for the project', async () => {
    findAuthorizedProjectRecipientIds.mockResolvedValue(['reporter']);

    await service.createWorkItemMutationNotifications({
      actorId,
      before: { ...baseAfter, status: 'ToDo' },
      after: baseAfter,
    });

    expect(insertMany).toHaveBeenCalledWith([
      expect.objectContaining({ user_id: 'reporter' }),
    ]);
  });

  it('uses a best-effort failure policy', async () => {
    insertMany.mockRejectedValue(new Error('database unavailable'));
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    await expect(
      service.createWorkItemMutationNotifications({ actorId, after: baseAfter })
    ).resolves.toBeUndefined();
    expect(consoleError).toHaveBeenCalledWith(
      'Error creating work-item notifications:',
      expect.any(Error)
    );
    consoleError.mockRestore();
  });
});

describe('NotificationsService.pruneReadNotifications', () => {
  const deleteReadOrArchivedOlderThan = vi.fn();
  const notificationsRepository = {
    deleteReadOrArchivedOlderThan,
  } as unknown as NotificationsRepository;
  const service = new NotificationsService(notificationsRepository);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes read or archived rows older than the retention window', async () => {
    // Arrange
    const now = new Date('2026-09-09T00:00:00.000Z');
    deleteReadOrArchivedOlderThan.mockResolvedValue(4);

    // Act
    const result = await service.pruneReadNotifications(now);

    // Assert
    expect(deleteReadOrArchivedOlderThan).toHaveBeenCalledWith(
      new Date('2026-08-10T00:00:00.000Z')
    );
    expect(result).toEqual({
      deletedCount: 4,
      cutoff: '2026-08-10T00:00:00.000Z',
      retentionDays: READ_NOTIFICATION_RETENTION_DAYS,
    });
  });
});

describe('NotificationsService.checkAndSendWorklogBurndownNotifications', () => {
  const findWorklogBurndownPending = vi.fn();
  const findExistingWorklogPendingUserIds = vi.fn();
  const insertMany = vi.fn();
  const notificationsRepository = {
    findWorklogBurndownPending,
    findExistingWorklogPendingUserIds,
    insertMany,
  } as unknown as NotificationsRepository;
  const service = new NotificationsService(notificationsRepository);

  beforeEach(() => {
    vi.clearAllMocks();
    insertMany.mockResolvedValue(undefined);
  });

  it('aggregates pending hours per assignee and skips already-notified users', async () => {
    // Arrange
    findWorklogBurndownPending.mockResolvedValue([
      {
        assignee_id: 'user-1',
        sprint_id: 'sprint-a',
        estimated_points: 10,
        logged_hours: 2,
        ideal_spent_eod: 5,
        pending_hours: 3,
      },
      {
        assignee_id: 'user-1',
        sprint_id: 'sprint-b',
        estimated_points: 8,
        logged_hours: 1,
        ideal_spent_eod: 4,
        pending_hours: 3,
      },
      {
        assignee_id: 'user-2',
        sprint_id: 'sprint-a',
        estimated_points: 10,
        logged_hours: 1,
        ideal_spent_eod: 5,
        pending_hours: 4,
      },
    ]);
    findExistingWorklogPendingUserIds.mockResolvedValue(['user-2']);

    // Act
    const result = await service.checkAndSendWorklogBurndownNotifications(
      new Date('2026-11-06T08:00:00.000Z')
    );

    // Assert
    expect(findWorklogBurndownPending).toHaveBeenCalledWith('2026-11-06');
    expect(findExistingWorklogPendingUserIds).toHaveBeenCalledWith(
      expect.arrayContaining(['user-1', 'user-2']),
      '2026-11-06T00:00:00.000Z'
    );
    expect(insertMany).toHaveBeenCalledTimes(1);
    const inserted = insertMany.mock.calls[0]![0] as Array<{
      user_id: string;
      type: string;
      message: string;
      related_item_id: string | null;
    }>;
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({
      user_id: 'user-1',
      type: 'worklog_pending',
      related_item_id: null,
      message:
        "You're about 6 hours behind today's ideal pace — log work to catch up.",
    });
    expect(result).toEqual({ checkedCount: 3, createdCount: 1 });
  });

  it('returns zero created when nobody is behind ideal', async () => {
    // Arrange
    findWorklogBurndownPending.mockResolvedValue([]);

    // Act
    const result = await service.checkAndSendWorklogBurndownNotifications(
      new Date('2026-11-06T08:00:00.000Z')
    );

    // Assert
    expect(insertMany).not.toHaveBeenCalled();
    expect(result).toEqual({ checkedCount: 0, createdCount: 0 });
  });
});

describe('NotificationsService.runDailyReminders', () => {
  it('runs due-date and worklog jobs in parallel', async () => {
    // Arrange
    const service = new NotificationsService(
      {} as unknown as NotificationsRepository
    );
    const dueDates = { checkedCount: 2, createdCount: 1 };
    const worklogPending = { checkedCount: 4, createdCount: 2 };
    const dueSpy = vi
      .spyOn(service, 'checkAndSendDueDateNotifications')
      .mockResolvedValue(dueDates);
    const worklogSpy = vi
      .spyOn(service, 'checkAndSendWorklogBurndownNotifications')
      .mockResolvedValue(worklogPending);

    // Act
    const result = await service.runDailyReminders(
      new Date('2026-11-06T08:00:00.000Z')
    );

    // Assert
    expect(dueSpy).toHaveBeenCalledTimes(1);
    expect(worklogSpy).toHaveBeenCalledWith(
      new Date('2026-11-06T08:00:00.000Z')
    );
    expect(result).toEqual({ dueDates, worklogPending });
  });
});
