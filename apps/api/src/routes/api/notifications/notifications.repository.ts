import {
  Database,
  filterProductUsableUsers,
  UserRoleEnum,
  WorkItemStatusEnum,
  type NotificationType,
} from '@repo/types';
import { SupabaseClient } from '@supabase/supabase-js';
import { prisma } from '../../../lib/prisma';
import { prismaNotificationCreate } from '../../../lib/prisma-audit';
import {
  NotificationType as NotificationTypeEnum,
  RecordStatus,
} from '@repo/types/prisma';

export type DueWorkItemRow = {
  id: string;
  title: string;
  assignee_id: string | null;
  due_date: string | null;
};

export type ExistingDueDateNotificationRow = {
  user_id: string;
  related_item_id: string | null;
  message: string;
};

export class NotificationsRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async create(params: {
    subscriberId: string;
    message: string;
    title?: string;
  }) {
    await prisma.notifications.create({
      data: {
        user_id: params.subscriberId,
        type: NotificationTypeEnum.mention,
        message: params.message,
        read_status: false,
        status: RecordStatus.active,
      },
    });
  }

  async listActiveAdminIds(): Promise<string[]> {
    const { data: admins, error: adminsError } = await filterProductUsableUsers(
      this.db.from('users').select('id').eq('role', UserRoleEnum.admin)
    );

    if (adminsError) {
      throw new Error(`Failed to query admins: ${adminsError.message}`);
    }

    return (admins ?? []).map((admin) => admin.id);
  }

  async createMany(params: {
    fromEmail: string;
    fromName?: string;
    message: string;
    title?: string;
  }) {
    const adminIds = await this.listActiveAdminIds();
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

  async getUserName(userId: string): Promise<string | null> {
    const { data: actor } = await this.db
      .from('users')
      .select('name')
      .eq('id', userId)
      .maybeSingle();

    return actor?.name ?? null;
  }

  async insert(notification: NotificationType): Promise<void> {
    await prisma.notifications.create({
      data: prismaNotificationCreate(notification),
    });
  }

  async insertMany(notifications: NotificationType[]): Promise<void> {
    if (notifications.length === 0) {
      return;
    }

    await prisma.notifications.createMany({
      data: notifications.map(prismaNotificationCreate),
    });
  }

  async findDueWorkItems(
    todayStr: string,
    tomorrowStr: string
  ): Promise<DueWorkItemRow[]> {
    const { data: workItems, error: fetchError } = await this.db
      .from('work_items')
      .select('id, title, assignee_id, due_date')
      .not('assignee_id', 'is', null)
      .neq('status', WorkItemStatusEnum.Done)
      .or(`due_date.eq.${todayStr},due_date.eq.${tomorrowStr}`);

    if (fetchError) {
      console.error('Failed to fetch due work items:', fetchError);
      throw new Error(`Failed to fetch due work items: ${fetchError.message}`);
    }

    return workItems ?? [];
  }

  async findExistingDueDateNotifications(
    assigneeIds: string[],
    workItemIds: string[]
  ): Promise<ExistingDueDateNotificationRow[]> {
    const { data: existingNotifications, error: fetchNotifError } =
      await this.db
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

    return existingNotifications ?? [];
  }
}
