import { Router } from 'express';
import { z } from 'zod';
import { notificationsService } from './notifications.service';

const notificationsRouter: Router = Router();

const sendSchema = z.object({
  subscriberId: z.string().min(1),
  message: z.string().min(1),
  title: z.string().optional(),
});

notificationsRouter.post('/send', async (req, res) => {
  const parsed = sendSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: z.treeifyError(parsed.error) });
  }

  const { subscriberId, message, title } = parsed.data;

  try {
    await notificationsService.ensureSubscriber(subscriberId);
    await notificationsService.sendInAppNotification({
      subscriberId,
      message,
      title,
    });

    res.json({ success: true });
  } catch (error) {
    const messageStr =
      error instanceof Error ? error.message : 'Failed to send notification';
    res.status(500).json({ error: messageStr });
  }
});

export default notificationsRouter;
