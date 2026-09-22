import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  NotificationsService,
  READ_NOTIFICATION_RETENTION_DAYS,
} from '../../src/routes/api/notifications/notifications.service';
import type { NotificationsRepository } from '../../src/routes/api/notifications/notifications.repository';

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
