import {
  NotificationBuilder,
  AssignNotification,
  MentionNotification,
  DueDateNotification,
  todayDateString,
  type NotificationType,
} from '@repo/types';
import { NotificationsRepository } from './notifications.repository';

export class NotificationsService {
  constructor(
    private readonly notificationsRepository: NotificationsRepository
  ) {}

  async sendInAppNotification(params: {
    subscriberId: string;
    message: string;
    title?: string;
  }) {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(params.subscriberId)) {
      try {
        await this.notificationsRepository.create(params);
      } catch (err) {
        console.error('Error inserting notification to Supabase:', err);
      }
    }
  }

  /**
   * Contact / access-request form: notify all active admins.
   * This endpoint intentionally uses a deterministic notification type so the
   * inbox can render an appropriate icon.
   */
  async sendAdminContactNotification(params: {
    fromEmail: string;
    fromName?: string;
    message: string;
    title?: string;
  }) {
    try {
      await this.notificationsRepository.createMany(params);
    } catch (err) {
      console.error('Error inserting notifications to Supabase:', err);
    }
  }

  private async notifyRelatedUser<T extends NotificationType>(params: {
    recipientId: string;
    actorId: string;
    taskId: string;
    typeClass: new () => T;
    buildMessage: (actorName: string) => string;
    logLabel: string;
  }): Promise<void> {
    if (params.recipientId === params.actorId) {
      return;
    }

    try {
      const actorName =
        (await this.notificationsRepository.getUserName(params.actorId)) ||
        'A teammate';

      const notification = new NotificationBuilder(params.typeClass)
        .ToUser(params.recipientId)
        .WithMessage(params.buildMessage(actorName))
        .WithRelatedItem(params.taskId)
        .WithCreatedBy(params.actorId)
        .WithUpdatedBy(params.actorId)
        .Build();

      await this.notificationsRepository.insert(notification);
    } catch (err) {
      console.error(params.logLabel, err);
    }
  }

  async createAssignNotification(params: {
    assigneeId: string;
    actorId: string;
    taskTitle: string;
    taskId: string;
  }) {
    await this.notifyRelatedUser({
      recipientId: params.assigneeId,
      actorId: params.actorId,
      taskId: params.taskId,
      typeClass: AssignNotification,
      buildMessage: (actorName) =>
        `${actorName} assigned a task to you: "${params.taskTitle}"`,
      logLabel: 'Error creating assign notification:',
    });
  }

  async createMentionNotification(params: {
    mentionedUserId: string;
    actorId: string;
    taskTitle: string;
    taskId: string;
    commentContentSnippet: string;
  }) {
    await this.notifyRelatedUser({
      recipientId: params.mentionedUserId,
      actorId: params.actorId,
      taskId: params.taskId,
      typeClass: MentionNotification,
      buildMessage: (actorName) =>
        `${actorName} mentioned you in a comment on "${params.taskTitle}": "${params.commentContentSnippet}"`,
      logLabel: 'Error creating mention notification:',
    });
  }

  private getDueDateMessage(
    title: string,
    dueDate: string | null,
    todayStr: string,
    tomorrowStr: string
  ): string {
    const dueStr = dueDate ? dueDate.split('T')[0] : '';
    if (!dueStr) return '';
    if (dueStr === todayStr) {
      return `Task "${title}" is due today (${todayStr})`;
    }
    if (dueStr === tomorrowStr) {
      return `Task "${title}" is due tomorrow (${tomorrowStr})`;
    }
    return '';
  }

  async checkAndSendDueDateNotifications() {
    const todayStr = todayDateString();
    const tomorrowDate = new Date();
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrowStr = todayDateString(tomorrowDate);

    const workItems = await this.notificationsRepository.findDueWorkItems(
      todayStr,
      tomorrowStr
    );
    if (workItems.length === 0) {
      return { checkedCount: 0, createdCount: 0 };
    }

    const assigneeIds = workItems.map((item) => item.assignee_id as string);
    const workItemIds = workItems.map((item) => item.id);

    const existingNotifications =
      await this.notificationsRepository.findExistingDueDateNotifications(
        assigneeIds,
        workItemIds
      );

    const existingMessagesSet = new Set(
      existingNotifications.map(
        (notification) =>
          `${notification.user_id}:${notification.related_item_id}:${notification.message}`
      )
    );

    const notificationsToInsert: DueDateNotification[] = [];

    for (const item of workItems) {
      const assigneeId = item.assignee_id as string;
      const msg = this.getDueDateMessage(
        item.title,
        item.due_date,
        todayStr,
        tomorrowStr
      );
      if (!msg) continue;
      const key = `${assigneeId}:${item.id}:${msg}`;
      if (existingMessagesSet.has(key)) {
        continue;
      }
      const notification = new NotificationBuilder(DueDateNotification)
        .ToUser(assigneeId)
        .WithMessage(msg)
        .WithRelatedItem(item.id)
        .Build();
      notificationsToInsert.push(notification);
    }

    await this.notificationsRepository.insertMany(notificationsToInsert);
    return {
      checkedCount: workItems.length,
      createdCount: notificationsToInsert.length,
    };
  }
}
