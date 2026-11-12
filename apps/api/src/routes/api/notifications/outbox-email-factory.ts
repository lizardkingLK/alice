import { EmailTemplate } from '@repo/types/prisma';
import { z } from 'zod';
import type { EmailMessage } from '../../../lib/email/email-transport';
import type {
  ClaimedEmailOutboxItem,
  OutboxEmailFactory,
} from './email-outbox-processor';
import {
  buildWorkItemAssignmentEmail,
  buildWorkItemReassignmentEmail,
  buildWorkItemStatusChangeEmail,
  buildWeeklyProjectReportEmail,
} from './work-item-email-templates';

const basePayload = z.object({
  recipientName: z.string(),
  actorName: z.string(),
  workItemId: z.string().min(1),
  workItemTitle: z.string(),
});

export class StoredEventOutboxEmailFactory implements OutboxEmailFactory {
  constructor(private readonly frontendUrl: string) {}

  build(item: ClaimedEmailOutboxItem): EmailMessage {
    if (!item.notificationId) {
      throw new Error('Notification email snapshot has no notification id.');
    }
    const common = {
      recipientEmail: item.recipientEmail,
      frontendUrl: this.frontendUrl,
      notificationId: item.notificationId,
    };

    switch (item.template) {
      case EmailTemplate.work_item_assignment:
        return buildWorkItemAssignmentEmail({
          ...common,
          ...basePayload.strict().parse(item.payload),
        });
      case EmailTemplate.work_item_reassignment:
        return buildWorkItemReassignmentEmail({
          ...common,
          ...basePayload
            .extend({ newAssigneeName: z.string().nullable().optional() })
            .strict()
            .parse(item.payload),
        });
      case EmailTemplate.work_item_status_change:
        return buildWorkItemStatusChangeEmail({
          ...common,
          ...basePayload
            .extend({ previousStatus: z.string(), nextStatus: z.string() })
            .strict()
            .parse(item.payload),
        });
      case EmailTemplate.weekly_project_report: {
        const payload = z
          .object({
            recipientName: z.string(),
            projectId: z.string().min(1),
            projectName: z.string(),
            weekLabel: z.string(),
            completedThisWeekCount: z.number().int().nonnegative(),
            createdCount: z.number().int().nonnegative(),
            overdueCount: z.number().int().nonnegative(),
            pendingCount: z.number().int().nonnegative(),
            progressPercent: z.number().int().min(0).max(100),
            statusSummary: z.record(z.string(), z.number().int().nonnegative()),
            periodStart: z.string(),
            periodEnd: z.string(),
            totalCount: z.number().int().nonnegative(),
            completedCount: z.number().int().nonnegative(),
          })
          .strict()
          .parse(item.payload);
        return buildWeeklyProjectReportEmail({
          ...common,
          ...payload,
          completedCount: payload.completedThisWeekCount,
        });
      }
      default:
        throw new Error(
          `Unsupported notification email template: ${item.template}`
        );
    }
  }
}
