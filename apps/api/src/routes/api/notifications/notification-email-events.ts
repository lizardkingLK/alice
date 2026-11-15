import { EmailTemplate, type Prisma } from '@repo/types/prisma';
import { z } from 'zod';

const baseWorkItemEventSchema = z
  .object({
    actorName: z.string(),
    workItemId: z.string().min(1),
    workItemTitle: z.string(),
  })
  .strict();

const notificationEmailEventSchema = z.discriminatedUnion('template', [
  z
    .object({
      version: z.literal(1),
      template: z.literal(EmailTemplate.work_item_assignment),
      payload: baseWorkItemEventSchema,
    })
    .strict(),
  z
    .object({
      version: z.literal(1),
      template: z.literal(EmailTemplate.work_item_reassignment),
      payload: baseWorkItemEventSchema
        .extend({ newAssigneeName: z.string().nullable().optional() })
        .strict(),
    })
    .strict(),
  z
    .object({
      version: z.literal(1),
      template: z.literal(EmailTemplate.work_item_status_change),
      payload: baseWorkItemEventSchema
        .extend({
          previousStatus: z.string(),
          nextStatus: z.string(),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      version: z.literal(1),
      template: z.literal(EmailTemplate.weekly_project_report),
      payload: z
        .object({
          projectId: z.string().min(1),
          projectName: z.string(),
          weekLabel: z.string(),
          periodStart: z.string(),
          periodEnd: z.string(),
          totalCount: z.number().int().nonnegative(),
          completedCount: z.number().int().nonnegative(),
          completedThisWeekCount: z.number().int().nonnegative(),
          pendingCount: z.number().int().nonnegative(),
          createdCount: z.number().int().nonnegative(),
          overdueCount: z.number().int().nonnegative(),
          progressPercent: z.number().int().min(0).max(100),
          statusSummary: z.record(z.string(), z.number().int().nonnegative()),
        })
        .strict(),
    })
    .strict(),
]);

export type NotificationEmailEvent = z.infer<
  typeof notificationEmailEventSchema
>;

export function parseNotificationEmailEvent(
  event: unknown
): NotificationEmailEvent {
  return notificationEmailEventSchema.parse(event);
}

export function notificationEmailEventCreateData(
  notificationId: string,
  event: NotificationEmailEvent
): Prisma.notification_email_eventsUncheckedCreateInput {
  return {
    notification_id: notificationId,
    version: event.version,
    template: event.template,
    payload: event.payload,
  };
}
