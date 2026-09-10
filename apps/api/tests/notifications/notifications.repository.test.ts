vi.hoisted(() => {
  process.env.GITHUB_ACTIONS = 'true';
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Database } from '@repo/types';
import type { SupabaseClient } from '@supabase/supabase-js';
import { RecordStatus } from '@repo/types/prisma';
import { NotificationsRepository } from '../../src/routes/api/notifications/notifications.repository';

const { deleteManyMock } = vi.hoisted(() => ({
  deleteManyMock: vi.fn(),
}));

vi.mock('../../src/lib/prisma', () => ({
  prisma: {
    notifications: {
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
