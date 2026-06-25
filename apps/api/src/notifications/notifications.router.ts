import { Router } from "express";
import { z } from "zod";
import { notificationsService } from "./notifications.service";

export const notificationsRouter: Router = Router();

const sendSchema = z.object({
  subscriberId: z.string().min(1),
  message: z.string().min(1),
  title: z.string().optional(),
});

notificationsRouter.post("/send", async (req, res) => {
  const parsed = sendSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const { subscriberId, message, title } = parsed.data;

  await notificationsService.ensureSubscriber(subscriberId);
  await notificationsService.sendInAppNotification({ subscriberId, message, title });

  res.json({ success: true });
});