import {
  NotificationBuilder,
  AssignNotification,
  MentionNotification,
  DueDateNotification,
  WorklogPendingNotification,
  formatWorklogPendingMessage,
  todayDateString,
  type NotificationType,
} from '@repo/types';
import { NotificationsRepository } from './notifications.repository';

export const READ_NOTIFICATION_RETENTION_DAYS = 30;
const READ_NOTIFICATION_RETENTION_MS =
  READ_NOTIFICATION_RETENTION_DAYS * 24 * 60 * 60 * 1000;

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
   * Generic contact notifications (non-access-request subjects).
   * Access requests use AccessRequestsService.submitFromContact.
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
      throw new Error('Failed to submit contact request');
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

  async checkAndSendWorklogBurndownNotifications(now = new Date()) {
    const todayStr = todayDateString(now);
    const rows =
      await this.notificationsRepository.findWorklogBurndownPending(todayStr);

    if (rows.length === 0) {
      return { checkedCount: 0, createdCount: 0 };
    }

    const pendingByAssignee = new Map<
      string,
      { pendingHours: number; sprintIds: Set<string> }
    >();

    for (const row of rows) {
      const pendingHours = Number(row.pending_hours);
      if (!Number.isFinite(pendingHours) || pendingHours <= 0) {
        continue;
      }
      const existing = pendingByAssignee.get(row.assignee_id);
      if (existing) {
        existing.pendingHours += pendingHours;
        existing.sprintIds.add(row.sprint_id);
        continue;
      }
      pendingByAssignee.set(row.assignee_id, {
        pendingHours,
        sprintIds: new Set([row.sprint_id]),
      });
    }

    if (pendingByAssignee.size === 0) {
      return { checkedCount: rows.length, createdCount: 0 };
    }

    const assigneeIds = [...pendingByAssignee.keys()];
    const dayStartIso = `${todayStr}T00:00:00.000Z`;
    const alreadyNotified =
      await this.notificationsRepository.findExistingWorklogPendingUserIds(
        assigneeIds,
        dayStartIso
      );
    const alreadyNotifiedSet = new Set(alreadyNotified);

    const notificationsToInsert: WorklogPendingNotification[] = [];

    for (const [assigneeId, aggregate] of pendingByAssignee) {
      if (alreadyNotifiedSet.has(assigneeId)) {
        continue;
      }
      const relatedSprintId =
        aggregate.sprintIds.size === 1
          ? ([...aggregate.sprintIds][0] ?? null)
          : null;
      const notification = new NotificationBuilder(WorklogPendingNotification)
        .ToUser(assigneeId)
        .WithMessage(formatWorklogPendingMessage(aggregate.pendingHours))
        .WithRelatedItem(relatedSprintId)
        .Build();
      notificationsToInsert.push(notification);
    }

    await this.notificationsRepository.insertMany(notificationsToInsert);
    return {
      checkedCount: rows.length,
      createdCount: notificationsToInsert.length,
    };
  }

  async runDailyReminders(now = new Date()) {
    const [dueDates, worklogPending] = await Promise.all([
      this.checkAndSendDueDateNotifications(),
      this.checkAndSendWorklogBurndownNotifications(now),
    ]);
    return { dueDates, worklogPending };
  }

  async pruneReadNotifications(now = new Date()) {
    const cutoff = new Date(now.getTime() - READ_NOTIFICATION_RETENTION_MS);

    const deletedCount =
      await this.notificationsRepository.deleteReadOrArchivedOlderThan(cutoff);

    return {
      deletedCount,
      cutoff: cutoff.toISOString(),
      retentionDays: READ_NOTIFICATION_RETENTION_DAYS,
    };
  }
}
