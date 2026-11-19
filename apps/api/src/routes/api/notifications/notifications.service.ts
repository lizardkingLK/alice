import {
  NotificationBuilder,
  AssignNotification,
  StatusChangeNotification,
  MentionNotification,
  DueDateNotification,
  WorklogPendingNotification,
  formatWorklogPendingMessage,
  todayDateString,
  type NotificationType,
} from '@repo/types';
import { NotificationsRepository } from './notifications.repository';
import { EmailTemplate, type Prisma } from '@repo/types/prisma';
import type { PrismaEmailOutboxRepository } from './email-outbox.repository';
import {
  parseNotificationEmailEvent,
  type NotificationEmailEvent,
} from './notification-email-events';

export const READ_NOTIFICATION_RETENTION_DAYS = 30;
const READ_NOTIFICATION_RETENTION_MS =
  READ_NOTIFICATION_RETENTION_DAYS * 24 * 60 * 60 * 1000;

type WorkItemNotificationRow = {
  id: string;
  project_id: string;
  title: string;
  assignee_id: string | null;
  reporter_id: string | null;
  created_by: string | null;
  status: string;
};

type WorkItemNotificationDetails = {
  type: typeof AssignNotification | typeof StatusChangeNotification;
  message: string;
  emailTemplate: EmailTemplate;
  emailPayload: Prisma.JsonObject;
};

export type PersistedWorkItemNotificationEmail = {
  notificationId: string;
  template: EmailTemplate;
  payload: Prisma.JsonObject;
};

function buildNotificationEmailEvent(
  details: Pick<WorkItemNotificationDetails, 'emailTemplate' | 'emailPayload'>
): NotificationEmailEvent {
  return parseNotificationEmailEvent({
    version: 1,
    template: details.emailTemplate,
    payload: details.emailPayload,
  });
}

function addReassignmentNotifications(params: {
  messages: Map<string, WorkItemNotificationDetails>;
  actorId: string;
  actorName: string;
  newAssigneeName: string | null;
  before: WorkItemNotificationRow;
  after: WorkItemNotificationRow;
}) {
  const { messages, actorId, actorName, newAssigneeName, before, after } =
    params;
  if (before.assignee_id === after.assignee_id) return;

  if (before.assignee_id && before.assignee_id !== actorId) {
    messages.set(before.assignee_id, {
      type: AssignNotification,
      message: after.assignee_id
        ? `${actorName} reassigned "${after.title}" to someone else`
        : `${actorName} unassigned you from "${after.title}"`,
      emailTemplate: EmailTemplate.work_item_reassignment,
      emailPayload: {
        actorName,
        workItemId: after.id,
        workItemTitle: after.title,
        ...(newAssigneeName ? { newAssigneeName } : {}),
      },
    });
  }
  if (after.assignee_id && after.assignee_id !== actorId) {
    messages.set(after.assignee_id, {
      type: AssignNotification,
      message: `${actorName} assigned a task to you: "${after.title}"`,
      emailTemplate: EmailTemplate.work_item_assignment,
      emailPayload: {
        actorName,
        workItemId: after.id,
        workItemTitle: after.title,
      },
    });
  }
}

function addStatusChangeNotifications(params: {
  messages: Map<string, WorkItemNotificationDetails>;
  actorId: string;
  actorName: string;
  before: WorkItemNotificationRow;
  after: WorkItemNotificationRow;
}) {
  const { messages, actorId, actorName, before, after } = params;
  if (before.status === after.status) return;

  for (const recipientId of [
    after.assignee_id,
    after.reporter_id ?? after.created_by,
  ]) {
    if (!recipientId || recipientId === actorId || messages.has(recipientId)) {
      continue;
    }
    messages.set(recipientId, {
      type: StatusChangeNotification,
      message: `${actorName} changed "${after.title}" from ${before.status} to ${after.status}`,
      emailTemplate: EmailTemplate.work_item_status_change,
      emailPayload: {
        actorName,
        workItemId: after.id,
        workItemTitle: after.title,
        previousStatus: before.status,
        nextStatus: after.status,
      },
    });
  }
}

function buildWorkItemNotificationMessages(params: {
  actorId: string;
  actorName: string;
  newAssigneeName: string | null;
  before?: WorkItemNotificationRow | null;
  after: WorkItemNotificationRow;
}): Map<string, WorkItemNotificationDetails> {
  const { actorId, actorName, newAssigneeName, before, after } = params;
  const messages = new Map<string, WorkItemNotificationDetails>();
  if (!before) {
    if (after.assignee_id && after.assignee_id !== actorId) {
      messages.set(after.assignee_id, {
        type: AssignNotification,
        message: `${actorName} assigned a task to you: "${after.title}"`,
        emailTemplate: EmailTemplate.work_item_assignment,
        emailPayload: {
          actorName,
          workItemId: after.id,
          workItemTitle: after.title,
        },
      });
    }
    return messages;
  }

  addReassignmentNotifications({
    messages,
    actorId,
    actorName,
    newAssigneeName,
    before,
    after,
  });
  addStatusChangeNotifications({ messages, actorId, actorName, before, after });
  return messages;
}

export class NotificationsService {
  constructor(
    private readonly notificationsRepository: NotificationsRepository,
    private readonly emailOutboxRepository?: Pick<
      PrismaEmailOutboxRepository,
      'createForNotification'
    >
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

  async createWorkItemMutationNotifications(params: {
    actorId: string;
    before?: WorkItemNotificationRow | null;
    after: WorkItemNotificationRow;
    client?: Prisma.TransactionClient;
  }): Promise<PersistedWorkItemNotificationEmail[]> {
    const { actorId, before, after } = params;
    const getUserName = (userId: string) =>
      params.client
        ? this.notificationsRepository.getUserName(userId, params.client)
        : this.notificationsRepository.getUserName(userId);
    const [actorNameResult, newAssigneeName] = await Promise.all([
      getUserName(actorId),
      before?.assignee_id !== after.assignee_id && after.assignee_id
        ? getUserName(after.assignee_id)
        : Promise.resolve(null),
    ]);
    const actorName = actorNameResult || 'A teammate';
    const messages = buildWorkItemNotificationMessages({
      actorId,
      actorName,
      newAssigneeName,
      before,
      after,
    });

    const authorizedIds = params.client
      ? await this.notificationsRepository.findAuthorizedProjectRecipientIds(
          after.project_id,
          [...messages.keys()],
          params.client
        )
      : await this.notificationsRepository.findAuthorizedProjectRecipientIds(
          after.project_id,
          [...messages.keys()]
        );
    const notificationEmails = authorizedIds.flatMap((recipientId) => {
      const details = messages.get(recipientId);
      if (!details) return [];
      return [
        {
          notification: new NotificationBuilder(details.type)
            .ToUser(recipientId)
            .WithMessage(details.message)
            .WithRelatedItem(after.id)
            .WithCreatedBy(actorId)
            .WithUpdatedBy(actorId)
            .Build(),
          template: details.emailTemplate,
          payload: details.emailPayload,
        },
      ];
    });

    const notifications = notificationEmails.map((entry) => entry.notification);
    const emailEvents = notificationEmails.map((entry) =>
      buildNotificationEmailEvent({
        emailTemplate: entry.template,
        emailPayload: entry.payload,
      })
    );
    const persisted = await this.notificationsRepository.insertMany(
      notifications,
      {
        ...(params.client ? { client: params.client } : {}),
        emailEvents,
      }
    );
    return persisted.flatMap((notification, index) => {
      const email = notificationEmails[index];
      return email
        ? [
            {
              notificationId: notification.id,
              template: email.template,
              payload: email.payload,
            },
          ]
        : [];
    });
  }

  async createWorkItemEmailOutbox(
    persistedEmails: readonly PersistedWorkItemNotificationEmail[]
  ): Promise<void> {
    if (!this.emailOutboxRepository) return;
    const results = await Promise.allSettled(
      persistedEmails.map((email) =>
        this.emailOutboxRepository!.createForNotification(email)
      )
    );
    for (const result of results) {
      if (result.status === 'rejected') {
        console.error(
          'Error creating email outbox for persisted notification:',
          result.reason
        );
      }
    }
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
