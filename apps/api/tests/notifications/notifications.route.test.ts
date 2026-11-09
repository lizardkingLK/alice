vi.hoisted(() => {
  process.env.GITHUB_ACTIONS = 'true';
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AccessRequestsService } from '../../src/routes/api/access-requests/access-requests.service';
import { createNotificationsRouter } from '../../src/routes/api/notifications/notifications.route';
import type { NotificationsService } from '../../src/routes/api/notifications/notifications.service';
import { withMountedRouter } from '../helpers/route-test.harness';

const pruneReadNotifications = vi.fn();
const runDailyReminders = vi.fn();
const notificationsService = {
  pruneReadNotifications,
  runDailyReminders,
} as unknown as NotificationsService;

const notificationsRouter = createNotificationsRouter({
  notificationsService,
  accessRequestsService: {} as AccessRequestsService,
});

describe('GET /api/notifications/prune-read', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects requests without the cron bearer token', async () => {
    await withMountedRouter(
      '/api/notifications',
      notificationsRouter,
      async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/notifications/prune-read`);

        expect(response.status).toBe(401);
        expect(await response.json()).toEqual({ error: 'Unauthorized' });
        expect(pruneReadNotifications).not.toHaveBeenCalled();
      }
    );
  });

  it('prunes read notifications when authorized', async () => {
    pruneReadNotifications.mockResolvedValue({
      deletedCount: 2,
      cutoff: '2026-08-10T00:00:00.000Z',
      retentionDays: 30,
    });

    await withMountedRouter(
      '/api/notifications',
      notificationsRouter,
      async (baseUrl) => {
        const response = await fetch(
          `${baseUrl}/api/notifications/prune-read`,
          {
            headers: { Authorization: 'Bearer mock-cron-secret' },
          }
        );

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({
          success: true,
          deletedCount: 2,
          cutoff: '2026-08-10T00:00:00.000Z',
          retentionDays: 30,
        });
        expect(pruneReadNotifications).toHaveBeenCalledTimes(1);
      }
    );
  });
});

describe('GET /api/notifications/daily-reminders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects requests without the cron bearer token', async () => {
    await withMountedRouter(
      '/api/notifications',
      notificationsRouter,
      async (baseUrl) => {
        const response = await fetch(
          `${baseUrl}/api/notifications/daily-reminders`
        );

        expect(response.status).toBe(401);
        expect(await response.json()).toEqual({ error: 'Unauthorized' });
        expect(runDailyReminders).not.toHaveBeenCalled();
      }
    );
  });

  it('runs both reminder jobs when authorized', async () => {
    runDailyReminders.mockResolvedValue({
      dueDates: { checkedCount: 2, createdCount: 1 },
      worklogPending: { checkedCount: 3, createdCount: 2 },
    });

    await withMountedRouter(
      '/api/notifications',
      notificationsRouter,
      async (baseUrl) => {
        const response = await fetch(
          `${baseUrl}/api/notifications/daily-reminders`,
          {
            headers: { Authorization: 'Bearer mock-cron-secret' },
          }
        );

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({
          success: true,
          dueDates: { checkedCount: 2, createdCount: 1 },
          worklogPending: { checkedCount: 3, createdCount: 2 },
        });
        expect(runDailyReminders).toHaveBeenCalledTimes(1);
      }
    );
  });
});
