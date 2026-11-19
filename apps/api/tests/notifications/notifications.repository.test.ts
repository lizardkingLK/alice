vi.hoisted(() => {
  process.env.GITHUB_ACTIONS = 'true';
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Database } from '@repo/types';
import type { SupabaseClient } from '@supabase/supabase-js';
import { RecordStatus } from '@repo/types/prisma';
import { NotificationsRepository } from '../../src/routes/api/notifications/notifications.repository';
import type { NotificationEmailEvent } from '../../src/routes/api/notifications/notification-email-events';

const { createMock, deleteManyMock, eventCreateMock, transactionMock } =
  vi.hoisted(() => ({
    createMock: vi.fn(),
    deleteManyMock: vi.fn(),
    eventCreateMock: vi.fn(),
    transactionMock: vi.fn(),
  }));

vi.mock('../../src/lib/prisma', () => ({
  prisma: {
    $transaction: transactionMock,
    notifications: {
      create: createMock,
      deleteMany: deleteManyMock,
    },
    notification_email_events: { create: eventCreateMock },
  },
}));

const mockDb = {
  from: vi.fn(),
} as unknown as SupabaseClient<Database>;

describe('NotificationsRepository.deleteReadOrArchivedOlderThan', () => {
  const repository = new NotificationsRepository(mockDb);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes read or archived rows created before the cutoff', async () => {
    // Arrange
    const cutoff = new Date('2026-08-10T00:00:00.000Z');
    deleteManyMock.mockResolvedValue({ count: 7 });

    // Act
    const deletedCount = await repository.deleteReadOrArchivedOlderThan(cutoff);

    // Assert
    expect(deletedCount).toBe(7);
    expect(deleteManyMock).toHaveBeenCalledWith({
      where: {
        created_at: { lt: cutoff },
        OR: [{ read_status: true }, { status: RecordStatus.archived }],
      },
    });
  });
});

describe('NotificationsRepository.insertMany', () => {
  const repository = new NotificationsRepository(mockDb);

  beforeEach(() => {
    vi.clearAllMocks();
    createMock
      .mockResolvedValueOnce({ id: 'notification-1', user_id: 'user-1' })
      .mockResolvedValueOnce({ id: 'notification-2', user_id: 'user-2' });
    eventCreateMock.mockResolvedValue({ notification_id: 'notification-1' });
    transactionMock.mockImplementation(
      async (callback: (client: unknown) => Promise<unknown>) =>
        await callback({
          notifications: { create: createMock },
          notification_email_events: { create: eventCreateMock },
        })
    );
  });

  it('returns persisted IDs from one notification transaction', async () => {
    const notifications = [
      {
        user_id: 'user-1',
        type: 'assign' as const,
        message: 'Assigned',
        read_status: false,
        updated_at: new Date().toISOString(),
        status: 'active' as const,
      },
      {
        user_id: 'user-2',
        type: 'status_change' as const,
        message: 'Changed',
        read_status: false,
        updated_at: new Date().toISOString(),
        status: 'active' as const,
      },
    ];

    const emailEvents = [
      {
        version: 1,
        template: 'work_item_assignment',
        payload: {
          actorName: 'Alex',
          workItemId: 'work-item-1',
          workItemTitle: 'Fix notifications',
        },
      },
      undefined,
    ] satisfies readonly (NotificationEmailEvent | undefined)[];

    await expect(
      repository.insertMany(notifications, { emailEvents })
    ).resolves.toEqual([
      { id: 'notification-1', user_id: 'user-1' },
      { id: 'notification-2', user_id: 'user-2' },
    ]);
    expect(transactionMock).toHaveBeenCalledOnce();
    expect(createMock).toHaveBeenCalledTimes(2);
    expect(eventCreateMock).toHaveBeenCalledOnce();
    expect(eventCreateMock).toHaveBeenCalledWith({
      data: {
        notification_id: 'notification-1',
        version: 1,
        template: 'work_item_assignment',
        payload: emailEvents[0]?.payload,
      },
    });
  });

  it('rejects the batch when notification persistence rolls back', async () => {
    const persistenceError = new Error('email event persistence failed');
    createMock.mockReset();
    createMock
      .mockResolvedValueOnce({ id: 'notification-1', user_id: 'user-1' })
      .mockResolvedValueOnce({ id: 'notification-2', user_id: 'user-2' });
    eventCreateMock.mockRejectedValueOnce(persistenceError);

    await expect(
      repository.insertMany(
        [
          {
            user_id: 'user-1',
            type: 'assign',
            message: 'Assigned',
            read_status: false,
            updated_at: new Date().toISOString(),
            status: 'active',
          },
          {
            user_id: 'user-2',
            type: 'assign',
            message: 'Assigned',
            read_status: false,
            updated_at: new Date().toISOString(),
            status: 'active',
          },
        ],
        {
          emailEvents: [
            {
              version: 1,
              template: 'work_item_assignment',
              payload: {
                actorName: 'Alex',
                workItemId: 'work-item-1',
                workItemTitle: 'First',
              },
            },
            {
              version: 1,
              template: 'work_item_assignment',
              payload: {
                actorName: 'Alex',
                workItemId: 'work-item-2',
                workItemTitle: 'Second',
              },
            },
          ],
        }
      )
    ).rejects.toBe(persistenceError);
    expect(transactionMock).toHaveBeenCalledOnce();
  });

  it('rejects unsupported event payloads before starting a transaction', async () => {
    await expect(
      repository.insertMany(
        [
          {
            user_id: 'user-1',
            type: 'assign',
            message: 'Assigned',
            read_status: false,
            updated_at: new Date().toISOString(),
            status: 'active',
          },
        ],
        {
          emailEvents: [
            {
              version: 1,
              template: 'work_item_assignment',
              payload: {
                actorName: 'Alex',
                workItemId: '',
                workItemTitle: 'Invalid',
              },
            },
          ],
        }
      )
    ).rejects.toThrow();
    expect(transactionMock).not.toHaveBeenCalled();
  });
});
