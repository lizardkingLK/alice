import { buildEmailIdempotencyKey } from '../../../lib/email/email-delivery-policy';
import { prisma } from '../../../lib/prisma';
import {
  EmailOutboxStatus,
  EmailTemplate,
  NotificationType,
  Prisma,
  UserMembershipStatus,
} from '@repo/types/prisma';
import type {
  ClaimedEmailOutboxItem,
  EmailOutboxRepository,
} from './email-outbox-processor';

type EmailOutboxPrismaClient = Pick<
  typeof prisma,
  '$queryRaw' | 'email_outbox' | 'notifications' | 'users'
>;

type CreateOutboxInput = {
  readonly notificationId: string;
  readonly template: EmailTemplate;
  readonly payload: Prisma.JsonObject;
};

type ClaimedOutboxRow = {
  id: string;
  notification_id: string | null;
  user_id: string | null;
  recipient_email: string;
  template: EmailTemplate;
  payload: Prisma.JsonValue;
  idempotency_key: string;
  attempt_count: number;
  max_attempts: number;
};

const TEMPLATE_NOTIFICATION_TYPE: Record<EmailTemplate, NotificationType> = {
  [EmailTemplate.work_item_assignment]: NotificationType.assign,
  [EmailTemplate.work_item_reassignment]: NotificationType.assign,
  [EmailTemplate.work_item_status_change]: NotificationType.status_change,
  [EmailTemplate.weekly_project_report]: NotificationType.weekly_project_report,
};

function preferenceAllows(
  template: EmailTemplate,
  preference: {
    email_enabled: boolean;
    work_item_assignment_enabled: boolean;
    work_item_reassignment_enabled: boolean;
    work_item_status_change_enabled: boolean;
    weekly_reports_enabled: boolean;
  } | null
): boolean {
  if (preference && !preference.email_enabled) return false;
  switch (template) {
    case EmailTemplate.work_item_assignment:
      return preference?.work_item_assignment_enabled ?? true;
    case EmailTemplate.work_item_reassignment:
      return preference?.work_item_reassignment_enabled ?? true;
    case EmailTemplate.work_item_status_change:
      return preference?.work_item_status_change_enabled ?? true;
    case EmailTemplate.weekly_project_report:
      return preference?.weekly_reports_enabled ?? false;
  }
}

function toClaimedItem(row: ClaimedOutboxRow): ClaimedEmailOutboxItem {
  return {
    id: row.id,
    notificationId: row.notification_id,
    userId: row.user_id,
    recipientEmail: row.recipient_email,
    template: row.template,
    payload: row.payload,
    idempotencyKey: row.idempotency_key,
    attemptCount: row.attempt_count,
    maxAttempts: row.max_attempts,
  };
}

export class PrismaEmailOutboxRepository implements EmailOutboxRepository {
  constructor(private readonly client: EmailOutboxPrismaClient = prisma) {}

  async createForNotification(
    input: CreateOutboxInput
  ): Promise<{ id: string } | null> {
    const notification = await this.client.notifications.findUnique({
      where: { id: input.notificationId },
      select: { user_id: true, type: true },
    });
    if (!notification) {
      throw new Error('Notification not found for email outbox.');
    }
    if (notification.type !== TEMPLATE_NOTIFICATION_TYPE[input.template]) {
      throw new Error('Email template does not match notification type.');
    }

    const recipient = await this.client.users.findFirst({
      where: {
        id: notification.user_id,
        active: true,
        membership_status: UserMembershipStatus.active,
      },
      select: {
        id: true,
        email: true,
        name: true,
        notification_email_preference: {
          select: {
            email_enabled: true,
            work_item_assignment_enabled: true,
            work_item_reassignment_enabled: true,
            work_item_status_change_enabled: true,
            weekly_reports_enabled: true,
          },
        },
      },
    });
    if (
      !recipient ||
      !preferenceAllows(input.template, recipient.notification_email_preference)
    ) {
      return null;
    }

    return await this.client.email_outbox.upsert({
      where: { notification_id: input.notificationId },
      update: {},
      create: {
        notification_id: input.notificationId,
        user_id: recipient.id,
        recipient_email: recipient.email,
        template: input.template,
        payload: {
          ...input.payload,
          recipientName: recipient.name,
        },
        idempotency_key: buildEmailIdempotencyKey(
          input.template,
          input.notificationId
        ),
      },
      select: { id: true },
    });
  }

  async claimBatch(input: {
    readonly workerId: string;
    readonly limit: number;
    readonly now: Date;
    readonly leaseUntil: Date;
  }): Promise<readonly ClaimedEmailOutboxItem[]> {
    const limit = Math.max(1, Math.min(Math.trunc(input.limit), 100));
    const rows = await this.client.$queryRaw<ClaimedOutboxRow[]>(Prisma.sql`
      WITH candidates AS (
        SELECT id
        FROM email_outbox
        WHERE (
          status IN (
            CAST(${EmailOutboxStatus.pending} AS "EmailOutboxStatus"),
            CAST(${EmailOutboxStatus.retry} AS "EmailOutboxStatus")
          )
          AND next_attempt_at <= ${input.now}
        ) OR (
          status = CAST(${EmailOutboxStatus.processing} AS "EmailOutboxStatus")
          AND locked_until < ${input.now}
        )
        ORDER BY next_attempt_at, created_at
        FOR UPDATE SKIP LOCKED
        LIMIT ${limit}
      )
      UPDATE email_outbox AS outbox
      SET status = CAST(${EmailOutboxStatus.processing} AS "EmailOutboxStatus"),
          locked_by = ${input.workerId},
          locked_at = ${input.now},
          locked_until = ${input.leaseUntil},
          last_attempt_at = ${input.now},
          updated_at = ${input.now}
      FROM candidates
      WHERE outbox.id = candidates.id
      RETURNING
        outbox.id,
        outbox.notification_id,
        outbox.user_id,
        outbox.recipient_email,
        outbox.template,
        outbox.payload,
        outbox.idempotency_key,
        outbox.attempt_count,
        outbox.max_attempts
    `);
    return rows.map(toClaimedItem);
  }

  async renewLease(input: {
    readonly id: string;
    readonly workerId: string;
    readonly now: Date;
    readonly leaseUntil: Date;
  }): Promise<boolean> {
    const result = await this.client.email_outbox.updateMany({
      where: {
        id: input.id,
        status: EmailOutboxStatus.processing,
        locked_by: input.workerId,
        locked_until: { gt: input.now },
      },
      data: { locked_until: input.leaseUntil },
    });
    return result.count === 1;
  }

  async shouldDeliver(item: ClaimedEmailOutboxItem): Promise<boolean> {
    if (
      !item.userId ||
      !Object.values(EmailTemplate).includes(item.template as EmailTemplate)
    ) {
      return false;
    }
    const recipient = await this.client.users.findFirst({
      where: {
        id: item.userId,
        active: true,
        membership_status: UserMembershipStatus.active,
      },
      select: {
        email: true,
        notification_email_preference: {
          select: {
            email_enabled: true,
            work_item_assignment_enabled: true,
            work_item_reassignment_enabled: true,
            work_item_status_change_enabled: true,
            weekly_reports_enabled: true,
          },
        },
      },
    });
    return Boolean(
      recipient &&
      recipient.email === item.recipientEmail &&
      preferenceAllows(
        item.template as EmailTemplate,
        recipient.notification_email_preference
      )
    );
  }

  async markSent(input: {
    readonly id: string;
    readonly workerId: string;
    readonly sentAt: Date;
  }): Promise<boolean> {
    return await this.transition(input, {
      status: EmailOutboxStatus.sent,
      sent_at: input.sentAt,
      last_error_code: null,
      last_error_message: null,
    });
  }

  async markRetry(input: {
    readonly id: string;
    readonly workerId: string;
    readonly attemptCount: number;
    readonly nextAttemptAt: Date;
    readonly errorCode: string;
    readonly errorMessage: string;
  }): Promise<boolean> {
    return await this.transition(input, {
      status: EmailOutboxStatus.retry,
      attempt_count: input.attemptCount,
      next_attempt_at: input.nextAttemptAt,
      last_error_code: input.errorCode,
      last_error_message: input.errorMessage,
    });
  }

  async markCancelled(input: {
    readonly id: string;
    readonly workerId: string;
    readonly cancelledAt: Date;
    readonly reason: string;
  }): Promise<boolean> {
    return await this.transition(input, {
      status: EmailOutboxStatus.cancelled,
      cancelled_at: input.cancelledAt,
      last_error_code: input.reason,
    });
  }

  async markDead(input: {
    readonly id: string;
    readonly workerId: string;
    readonly attemptCount: number;
    readonly failedAt: Date;
    readonly errorCode: string;
    readonly errorMessage: string;
  }): Promise<boolean> {
    return await this.transition(input, {
      status: EmailOutboxStatus.dead,
      attempt_count: input.attemptCount,
      failed_at: input.failedAt,
      last_error_code: input.errorCode,
      last_error_message: input.errorMessage,
    });
  }

  private async transition(
    input: { readonly id: string; readonly workerId: string },
    data: Prisma.email_outboxUpdateManyMutationInput
  ): Promise<boolean> {
    const result = await this.client.email_outbox.updateMany({
      where: {
        id: input.id,
        status: EmailOutboxStatus.processing,
        locked_by: input.workerId,
      },
      data: {
        ...data,
        locked_by: null,
        locked_at: null,
        locked_until: null,
      },
    });
    return result.count === 1;
  }
}
