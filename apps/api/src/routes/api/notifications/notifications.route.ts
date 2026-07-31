import { Router, type Response } from 'express';
import { z } from 'zod';
import { contactRequestSchema } from '@repo/types';
import { notificationsService } from './notifications.service';

const notificationsRouter: Router = Router();

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

  const { email, name, title, message } = parsed.data;

  try {
    await notificationsService.sendAdminContactNotification({
      fromEmail: email,
      fromName: name,
      title,
      message,
    });

    res.json({ success: true });
  } catch (error) {
    routeError(res, error);
  }
});

notificationsRouter.get('/check-due-dates', async (req, res) => {
  try {
    const result =
      await notificationsService.checkAndSendDueDateNotifications();
    res.json({ success: true, ...result });
  } catch (error) {
    routeError(res, error);
  }
});

export default notificationsRouter;
