vi.hoisted(() => {
  process.env.GITHUB_ACTIONS = 'true';
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Database } from '@repo/types';
import type { SupabaseClient } from '@supabase/supabase-js';
import { RecordStatus } from '@repo/types/prisma';
import { NotificationsRepository } from '../../src/routes/api/notifications/notifications.repository';

const { createMock, deleteManyMock, transactionMock } = vi.hoisted(() => ({
  createMock: vi.fn(),
  deleteManyMock: vi.fn(),
  transactionMock: vi.fn(),
}));

vi.mock('../../src/lib/prisma', () => ({
  prisma: {
    $transaction: transactionMock,
    notifications: {
      create: createMock,
      deleteMany: deleteManyMock,
    },
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
    transactionMock.mockImplementation(async (operations: Promise<unknown>[]) =>
      Promise.all(operations)
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

    await expect(repository.insertMany(notifications)).resolves.toEqual([
      { id: 'notification-1', user_id: 'user-1' },
      { id: 'notification-2', user_id: 'user-2' },
    ]);
    expect(transactionMock).toHaveBeenCalledOnce();
    expect(createMock).toHaveBeenCalledTimes(2);
  });
});
