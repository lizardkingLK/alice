import { Router, type Response } from 'express';
import { z } from 'zod';
import {
  ACCESS_REQUEST_ALREADY_GRANTED_MESSAGE,
  ACCESS_REQUEST_LIMIT_MESSAGE,
  contactRequestSchema,
} from '@repo/types';
import { env } from '../../../config/env';
import { NotificationsService } from './notifications.service';
import type { AccessRequestsService } from '../accessRequests/accessRequests.service';

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
  const secret = env.CRON_SECRET;
  if (!secret) {
    // Local/dev without CRON_SECRET: allow (matches optional env). Prod should set it.
    return true;
  }
  const header = req.headers.authorization;
  return header === `Bearer ${secret}`;
}

export type NotificationsRouterDeps = {
  notificationsService: NotificationsService;
  accessRequestsService: AccessRequestsService;
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
    if (!assertCronAuthorized(req)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const result =
        await notificationsService.checkAndSendDueDateNotifications();
      res.json({ success: true, ...result });
    } catch (error) {
      routeError(res, error);
    }
  });

  return notificationsRouter;
}
