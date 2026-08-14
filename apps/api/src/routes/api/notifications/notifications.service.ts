import { supabase } from '../../../lib/supabase';
import { prisma } from '../../../lib/prisma';
import { prismaNotificationCreate } from '../../../lib/prisma-audit';
import {
  NotificationBuilder,
  AssignNotification,
  MentionNotification,
  DueDateNotification,
  todayDateString,
  UserRoleEnum,
  WorkItemStatusEnum,
} from '@repo/types';
import {
  NotificationType as NotificationTypeEnum,
  RecordStatus,
} from '@repo/types/prisma';

export class NotificationsService {
  async sendInAppNotification(params: {
    subscriberId: string;
    message: string;
    title?: string;
  }) {
    // Save to Supabase notifications table if subscriberId is a valid UUID
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(params.subscriberId)) {
      try {
        await prisma.notifications.create({
          data: {
            user_id: params.subscriberId,
            type: NotificationTypeEnum.mention,
            message: params.message,
            read_status: false,
            status: RecordStatus.active,
          },
        });
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
    const { data: admins, error: adminsError } = await supabase
      .from('users')
      .select('id')
      .eq('role', UserRoleEnum.admin)
      .eq('active', true);

    if (adminsError) {
      throw new Error(`Failed to query admins: ${adminsError.message}`);
    }

    const adminIds = (admins ?? []).map((a) => a.id);
    if (!adminIds.length) {
      return;
    }

    const fromNamePart = params.fromName ? ` (${params.fromName})` : '';
    const titlePrefix = params.title ? `${params.title}\n\n` : '';
    const fullMessage = `${titlePrefix}From: ${params.fromEmail}${fromNamePart}\n\n${params.message}`;

    await prisma.notifications.createMany({
      data: adminIds.map((adminId) => ({
        user_id: adminId,
        type: NotificationTypeEnum.comment,
        message: fullMessage,
        read_status: false,
        status: RecordStatus.active,
      })),
    });
  }

  async createAssignNotification(params: {
    assigneeId: string;
    actorId: string;
    taskTitle: string;
    taskId: string;
  }) {
    if (params.assigneeId === params.actorId) return;

    try {
      // Fetch actor name
      const { data: actor } = await supabase
        .from('users')
        .select('name')
        .eq('id', params.actorId)
        .maybeSingle();

      const actorName = actor?.name || 'A teammate';

      // Insert notification
      const notification = new NotificationBuilder(AssignNotification)
        .ToUser(params.assigneeId)
        .WithMessage(
          `${actorName} assigned a task to you: "${params.taskTitle}"`
        )
        .WithRelatedItem(params.taskId)
        .WithCreatedBy(params.actorId)
        .WithUpdatedBy(params.actorId)
        .Build();

      await prisma.notifications.create({
        data: prismaNotificationCreate(notification),
      });
    } catch (err) {
      console.error('Error creating assign notification:', err);
    }
  }

  async createMentionNotification(params: {
    mentionedUserId: string;
    actorId: string;
    taskTitle: string;
    taskId: string;
    commentContentSnippet: string;
  }) {
    if (params.mentionedUserId === params.actorId) return;

    try {
      // Fetch actor name
      const { data: actor } = await supabase
        .from('users')
        .select('name')
        .eq('id', params.actorId)
        .maybeSingle();

      const actorName = actor?.name || 'A teammate';

      const notification = new NotificationBuilder(MentionNotification)
        .ToUser(params.mentionedUserId)
        .WithMessage(
          `${actorName} mentioned you in a comment on "${params.taskTitle}": "${params.commentContentSnippet}"`
        )
        .WithRelatedItem(params.taskId)
        .WithCreatedBy(params.actorId)
        .WithUpdatedBy(params.actorId)
        .Build();

      await prisma.notifications.create({
        data: prismaNotificationCreate(notification),
      });
    } catch (err) {
      console.error('Error creating mention notification:', err);
    }
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

    // Fetch active work items (not Done status) with assignee and due date matching today or tomorrow
    const { data: workItems, error: fetchError } = await supabase
      .from('work_items')
      .select('id, title, assignee_id, due_date')
      .not('assignee_id', 'is', null)
      .neq('status', WorkItemStatusEnum.Done)
      .or(`due_date.eq.${todayStr},due_date.eq.${tomorrowStr}`);

    if (fetchError) {
      console.error('Failed to fetch due work items:', fetchError);
      throw new Error(`Failed to fetch due work items: ${fetchError.message}`);
    }
    if (!workItems || workItems.length === 0) {
      return { checkedCount: 0, createdCount: 0 };
    }
    // Get list of assignee IDs and work item IDs to fetch existing notifications
    const assigneeIds = workItems.map((item) => item.assignee_id as string);
    const workItemIds = workItems.map((item) => item.id);

    // Fetch existing due_date notifications for these assignees and work items
    const { data: existingNotifications, error: fetchNotifError } =
      await supabase
        .from('notifications')
        .select('user_id, related_item_id, message')
        .eq('type', 'due_date')
        .in('user_id', assigneeIds)
        .in('related_item_id', workItemIds);

    if (fetchNotifError) {
      console.error(
        'Failed to fetch existing due_date notifications:',
        fetchNotifError
      );
      throw new Error(
        `Failed to fetch existing notifications: ${fetchNotifError.message}`
      );
    }

    const existingMessagesSet = new Set(
      (existingNotifications || []).map(
        (n) => `${n.user_id}:${n.related_item_id}:${n.message}`
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

    if (notificationsToInsert.length > 0) {
      await prisma.notifications.createMany({
        data: notificationsToInsert.map(prismaNotificationCreate),
      });
    }
    return {
      checkedCount: workItems.length,
      createdCount: notificationsToInsert.length,
    };
  }
}

export const notificationsService = new NotificationsService();
