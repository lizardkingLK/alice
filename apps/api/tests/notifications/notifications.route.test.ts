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
const reconcile = vi.fn();
const processBatch = vi.fn();
const generate = vi.fn();
const notificationsService = {
  pruneReadNotifications,
  runDailyReminders,
} as unknown as NotificationsService;

const notificationsRouter = createNotificationsRouter({
  notificationsService,
  accessRequestsService: {} as AccessRequestsService,
  emailReconciler: { reconcile },
  emailOutboxProcessor: { processBatch },
  emailReconciliationEnabled: true,
  emailOutboxProcessingEnabled: true,
  weeklyProjectReportGenerator: { generate },
  weeklyReportGenerationEnabled: true,
});

describe('notification email cron routes', () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([
    ['/cron/reconcile-email', reconcile],
    ['/cron/process-email-outbox', processBatch],
    ['/cron/generate-weekly-reports', generate],
  ])('rejects unauthorized requests to %s', async (path, operation) => {
    await withMountedRouter(
      '/api/notifications',
      notificationsRouter,
      async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/notifications${path}`, {
          method: 'POST',
        });
        expect(response.status).toBe(401);
        expect(operation).not.toHaveBeenCalled();
      }
    );
  });

  it('runs each enabled job only with the cron secret', async () => {
    reconcile.mockResolvedValue({ checked: 0 });
    processBatch.mockResolvedValue({ claimed: 0 });
    generate.mockResolvedValue({ created: 0 });
    await withMountedRouter(
      '/api/notifications',
      notificationsRouter,
      async (baseUrl) => {
        for (const path of [
          '/cron/reconcile-email',
          '/cron/process-email-outbox',
          '/cron/generate-weekly-reports',
        ]) {
          const response = await fetch(`${baseUrl}/api/notifications${path}`, {
            method: 'POST',
            headers: { Authorization: 'Bearer mock-cron-secret' },
          });
          expect(response.status).toBe(200);
          expect(await response.json()).toMatchObject({
            success: true,
            enabled: true,
          });
        }
      }
    );
    expect(reconcile).toHaveBeenCalledOnce();
    expect(processBatch).toHaveBeenCalledOnce();
    expect(generate).toHaveBeenCalledOnce();
  });

  it('keeps both jobs inactive when their gates are disabled', async () => {
    const disabledRouter = createNotificationsRouter({
      notificationsService,
      accessRequestsService: {} as AccessRequestsService,
    });
    await withMountedRouter(
      '/api/notifications',
      disabledRouter,
      async (baseUrl) => {
        for (const path of [
          '/cron/reconcile-email',
          '/cron/process-email-outbox',
          '/cron/generate-weekly-reports',
        ]) {
          const response = await fetch(`${baseUrl}/api/notifications${path}`, {
            method: 'POST',
            headers: { Authorization: 'Bearer mock-cron-secret' },
          });
          expect(await response.json()).toEqual({
            success: true,
            enabled: false,
          });
        }
      }
    );
  });
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
