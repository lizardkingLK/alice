import { Router, type Response } from 'express';
import { z } from 'zod';
import {
  ACCESS_REQUEST_ALREADY_GRANTED_MESSAGE,
  ACCESS_REQUEST_LIMIT_MESSAGE,
  contactRequestSchema,
} from '@repo/types';
import { env } from '../../../config/env';
import type { NotificationsService } from './notifications.service';
import type { AccessRequestsService } from '../access-requests/access-requests.service';
import type { NotificationEmailReconciler } from './notification-email-reconciler';
import type { EmailOutboxProcessor } from './email-outbox-processor';
import type { WeeklyProjectReportGenerator } from './weekly-project-report-generator';

const sendSchema = z.object({
  subscriberId: z.string().min(1),
  message: z.string().min(1),
  title: z.string().optional(),
});

function routeError(res: Response, error: unknown): void {
  const messageStr =
    error instanceof Error ? error.message : 'Failed to send notification';
  res.status(500).json({ error: messageStr });
}

function assertCronAuthorized(req: {
  headers: { authorization?: string };
}): boolean {
  const header = req.headers.authorization;
  return header === `Bearer ${env.CRON_SECRET}`;
}

async function runAuthorizedCron<T extends object>(
  req: { headers: { authorization?: string } },
  res: Response,
  run: () => Promise<T>
): Promise<void> {
  if (!assertCronAuthorized(req)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const result = await run();
    res.json({ success: true, ...result });
  } catch (error) {
    routeError(res, error);
  }
}

export type NotificationsRouterDeps = {
  notificationsService: NotificationsService;
  accessRequestsService: AccessRequestsService;
  emailReconciler?: Pick<NotificationEmailReconciler, 'reconcile'>;
  emailOutboxProcessor?: Pick<EmailOutboxProcessor, 'processBatch'>;
  emailReconciliationEnabled?: boolean;
  emailOutboxProcessingEnabled?: boolean;
  weeklyProjectReportGenerator?: Pick<WeeklyProjectReportGenerator, 'generate'>;
  weeklyReportGenerationEnabled?: boolean;
};

export function createNotificationsRouter(deps: NotificationsRouterDeps) {
  const { notificationsService, accessRequestsService } = deps;

  const notificationsRouter: Router = Router();

  notificationsRouter.post('/send', async (req, res) => {
    const parsed = sendSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: z.treeifyError(parsed.error) });
    }

    const { subscriberId, message, title } = parsed.data;

    try {
      await notificationsService.sendInAppNotification({
        subscriberId,
        message,
        title,
      });

      res.json({ success: true });
    } catch (error) {
      routeError(res, error);
    }
  });

  notificationsRouter.post('/contact', async (req, res) => {
    const parsed = contactRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: z.treeifyError(parsed.error) });
    }

    try {
      await accessRequestsService.submitFromContact(parsed.data);

      res.json({ success: true });
    } catch (error) {
      const messageStr =
        error instanceof Error ? error.message : 'Failed to send notification';
      if (
        messageStr === ACCESS_REQUEST_LIMIT_MESSAGE ||
        messageStr === ACCESS_REQUEST_ALREADY_GRANTED_MESSAGE
      ) {
        return res.status(429).json({ error: messageStr });
      }
      routeError(res, error);
    }
  });

  notificationsRouter.get('/check-due-dates', async (req, res) => {
    await runAuthorizedCron(req, res, () =>
      notificationsService.checkAndSendDueDateNotifications()
    );
  });

  notificationsRouter.get('/daily-reminders', async (req, res) => {
    await runAuthorizedCron(req, res, () =>
      notificationsService.runDailyReminders()
    );
  });

  notificationsRouter.get('/prune-read', async (req, res) => {
    await runAuthorizedCron(req, res, () =>
      notificationsService.pruneReadNotifications()
    );
  });

  notificationsRouter.post('/cron/reconcile-email', async (req, res) => {
    await runAuthorizedCron(req, res, async () => {
      if (!deps.emailReconciliationEnabled || !deps.emailReconciler) {
        return { enabled: false };
      }
      return { enabled: true, ...(await deps.emailReconciler.reconcile()) };
    });
  });

  notificationsRouter.post('/cron/process-email-outbox', async (req, res) => {
    await runAuthorizedCron(req, res, async () => {
      if (!deps.emailOutboxProcessingEnabled || !deps.emailOutboxProcessor) {
        return { enabled: false };
      }
      return {
        enabled: true,
        ...(await deps.emailOutboxProcessor.processBatch()),
      };
    });
  });

  notificationsRouter.post(
    '/cron/generate-weekly-reports',
    async (req, res) => {
      await runAuthorizedCron(req, res, async () => {
        if (
          !deps.weeklyReportGenerationEnabled ||
          !deps.weeklyProjectReportGenerator
        ) {
          return { enabled: false };
        }
        return {
          enabled: true,
          ...(await deps.weeklyProjectReportGenerator.generate()),
        };
      });
    }
  );

  return notificationsRouter;
}
