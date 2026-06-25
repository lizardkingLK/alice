import { novu } from "./novu.client";

export class NotificationsService {
  async ensureSubscriber(subscriberId: string, email?: string) {
    await novu.subscribers.create({
      subscriberId,
      email,
    });
  }

  async sendInAppNotification(params: {
    subscriberId: string;
    message: string;
    title?: string;
  }) {
    await novu.trigger({
      workflowId: "alice",
      to: { subscriberId: params.subscriberId },
      payload: {
        message: params.message,
        title: params.title ?? "Notification",
      },
    });
  }
}

export const notificationsService = new NotificationsService();