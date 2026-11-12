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
      default:
        throw new Error(
          `Unsupported notification email template: ${item.template}`
        );
    }
  }
}
