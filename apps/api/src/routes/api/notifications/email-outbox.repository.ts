import { buildEmailIdempotencyKey } from '../../../lib/email/email-delivery-policy';
import { prisma } from '../../../lib/prisma';
import {
  EmailOutboxStatus,
  EmailTemplate,
  NotificationType,
  Prisma,
  ProjectStatus,
  RecordStatus,
  UserMembershipStatus,
  UserRole,
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

export type MissingNotificationEmailEvent = {
  notificationId: string;
  version: number;
  template: EmailTemplate;
  payload: Prisma.JsonValue;
};

type MissingNotificationEmailEventRow = {
  notification_id: string;
  version: number;
  template: EmailTemplate;
  payload: Prisma.JsonValue;
};

export const NOTIFICATION_EMAIL_RECONCILIATION_ROLLOUT_CUTOFF_ISO =
  '2026-11-12T00:00:00.000Z';
export const NOTIFICATION_EMAIL_RECONCILIATION_GRACE_MS = 5 * 60 * 1000;

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
      select: { user_id: true, type: true, related_item_id: true },
    });
    if (!notification) {
      return null;
    }
    if (notification.type !== TEMPLATE_NOTIFICATION_TYPE[input.template]) {
      throw new Error('Email template does not match notification type.');
    }
    if (
      input.template !== EmailTemplate.weekly_project_report &&
      !notification.related_item_id
    ) {
      return null;
    }

    const recipient = await this.client.users.findFirst({
      where: {
        id: notification.user_id,
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
    if (!recipient) {
      return null;
    }

    const weekly = input.template === EmailTemplate.weekly_project_report;
    const snapshotMatchesNotification = weekly
      ? input.payload.projectId === notification.related_item_id
      : input.payload.workItemId === notification.related_item_id;
    const authorized = Boolean(
      snapshotMatchesNotification &&
      notification.related_item_id &&
      (await this.client.users.findFirst({
        where: weekly
          ? {
              id: notification.user_id,
              active: true,
              status: RecordStatus.active,
              membership_status: UserMembershipStatus.active,
              weekly_report_subscriptions: {
                some: {
                  project_id: notification.related_item_id,
                  enabled: true,
                },
              },
              OR: [
                {
                  owned_projects: {
                    some: {
                      id: notification.related_item_id,
                      status: ProjectStatus.active,
                      deleted_at: null,
                    },
                  },
                },
                {
                  role: UserRole.manager,
                  project_memberships: {
                    some: {
                      status: RecordStatus.active,
                      project: {
                        id: notification.related_item_id,
                        status: ProjectStatus.active,
                        deleted_at: null,
                      },
                    },
                  },
                },
              ],
            }
          : {
              id: notification.user_id,
              active: true,
              status: RecordStatus.active,
              membership_status: UserMembershipStatus.active,
              OR: [
                {
                  owned_projects: {
                    some: {
                      work_items: {
                        some: { id: notification.related_item_id },
                      },
                    },
                  },
                },
                {
                  project_memberships: {
                    some: {
                      status: RecordStatus.active,
                      project: {
                        work_items: {
                          some: { id: notification.related_item_id },
                        },
                      },
                    },
                  },
                },
              ],
            },
        select: { id: true },
      }))
    );
    const preferenceAllowed = preferenceAllows(
      input.template,
      recipient.notification_email_preference
    );
    const allowed = authorized && preferenceAllowed;
    let cancellationReason = 'email_preference_disabled';
    if (!snapshotMatchesNotification) {
      cancellationReason = 'invalid_notification_email_event_reference';
    } else if (!authorized) {
      cancellationReason = 'recipient_not_authorized';
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
        ...(allowed
          ? {}
          : {
              status: EmailOutboxStatus.cancelled,
              cancelled_at: new Date(),
              last_error_code: cancellationReason,
            }),
      },
      select: { id: true },
    });
  }

  async findMissingNotificationEmailEvents(input: {
    readonly now: Date;
    readonly limit: number;
  }): Promise<readonly MissingNotificationEmailEvent[]> {
    const limit = Math.max(1, Math.min(Math.trunc(input.limit), 100));
    const graceCutoff = new Date(
      input.now.getTime() - NOTIFICATION_EMAIL_RECONCILIATION_GRACE_MS
    );
    const rolloutCutoff = new Date(
      NOTIFICATION_EMAIL_RECONCILIATION_ROLLOUT_CUTOFF_ISO
    );
    const rows = await this.client.$queryRaw<
      MissingNotificationEmailEventRow[]
    >(
      Prisma.sql`
        SELECT event.notification_id, event.version, event.template, event.payload
        FROM notification_email_events AS event
        LEFT JOIN email_outbox AS outbox
          ON outbox.notification_id = event.notification_id
        WHERE outbox.id IS NULL
          AND event.created_at >= ${rolloutCutoff}
          AND event.created_at <= ${graceCutoff}
        ORDER BY event.created_at ASC, event.notification_id ASC
        LIMIT ${limit}
      `
    );
    return rows.map((row) => ({
      notificationId: row.notification_id,
      version: row.version,
      template: row.template,
      payload: row.payload,
    }));
  }

  async createInvalidEventTerminal(
    input: MissingNotificationEmailEvent
  ): Promise<boolean> {
    const notification = await this.client.notifications.findUnique({
      where: { id: input.notificationId },
      select: { user_id: true },
    });
    if (!notification) return false;
    const recipient = await this.client.users.findFirst({
      where: { id: notification.user_id },
      select: { id: true, email: true, name: true },
    });
    if (!recipient) return false;

    await this.client.email_outbox.upsert({
      where: { notification_id: input.notificationId },
      update: {},
      create: {
        notification_id: input.notificationId,
        user_id: recipient.id,
        recipient_email: recipient.email,
        template: input.template,
        payload: {
          invalidSnapshot: input.payload,
          recipientName: recipient.name,
        },
        idempotency_key: buildEmailIdempotencyKey(
          input.template,
          input.notificationId
        ),
        status: EmailOutboxStatus.dead,
        failed_at: new Date(),
        last_error_code: 'invalid_notification_email_event',
      },
      select: { id: true },
    });
    return true;
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
    const notification = item.notificationId
      ? await this.client.notifications.findUnique({
          where: { id: item.notificationId },
          select: { user_id: true, type: true, related_item_id: true },
        })
      : null;
    const template = item.template as EmailTemplate;
    if (
      !notification ||
      notification.user_id !== item.userId ||
      notification.type !== TEMPLATE_NOTIFICATION_TYPE[template]
    ) {
      return false;
    }
    const workItemEligibility =
      template === EmailTemplate.weekly_project_report
        ? {
            weekly_report_subscriptions: {
              some: {
                project_id: notification.related_item_id!,
                enabled: true,
              },
            },
            OR: [
              {
                owned_projects: {
                  some: {
                    id: notification.related_item_id!,
                    status: ProjectStatus.active,
                    deleted_at: null,
                  },
                },
              },
              {
                role: UserRole.manager,
                project_memberships: {
                  some: {
                    status: RecordStatus.active,
                    project: {
                      id: notification.related_item_id!,
                      status: ProjectStatus.active,
                      deleted_at: null,
                    },
                  },
                },
              },
            ],
          }
        : {
            OR: [
              {
                owned_projects: {
                  some: {
                    work_items: { some: { id: notification.related_item_id! } },
                  },
                },
              },
              {
                project_memberships: {
                  some: {
                    status: RecordStatus.active,
                    project: {
                      work_items: {
                        some: { id: notification.related_item_id! },
                      },
                    },
                  },
                },
              },
            ],
          };
    if (!notification.related_item_id) {
      return false;
    }
    if (
      template === EmailTemplate.weekly_project_report &&
      (!item.payload ||
        typeof item.payload !== 'object' ||
        Array.isArray(item.payload) ||
        !('projectId' in item.payload) ||
        item.payload.projectId !== notification.related_item_id)
    ) {
      return false;
    }
    const recipient = await this.client.users.findFirst({
      where: {
        id: item.userId,
        active: true,
        status: RecordStatus.active,
        membership_status: UserMembershipStatus.active,
        ...workItemEligibility,
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
      preferenceAllows(template, recipient.notification_email_preference)
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
