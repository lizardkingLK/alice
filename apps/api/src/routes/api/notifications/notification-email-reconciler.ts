import { ZodError } from 'zod';
import type { PrismaEmailOutboxRepository } from './email-outbox.repository';
import { parseNotificationEmailEvent } from './notification-email-events';

export type NotificationEmailReconciliationResult = {
  checked: number;
  recovered: number;
  terminal: number;
  skipped: number;
  failed: number;
};

export class NotificationEmailReconciler {
  constructor(
    private readonly repository: Pick<
      PrismaEmailOutboxRepository,
      | 'findMissingNotificationEmailEvents'
      | 'createForNotification'
      | 'createInvalidEventTerminal'
    >,
    private readonly options: { readonly batchSize?: number } = {}
  ) {}

  async reconcile(
    now = new Date()
  ): Promise<NotificationEmailReconciliationResult> {
    const events = await this.repository.findMissingNotificationEmailEvents({
      now,
      limit: this.options.batchSize ?? 25,
    });
    const result: NotificationEmailReconciliationResult = {
      checked: events.length,
      recovered: 0,
      terminal: 0,
      skipped: 0,
      failed: 0,
    };

    for (const snapshot of events) {
      try {
        const event = parseNotificationEmailEvent({
          version: snapshot.version,
          template: snapshot.template,
          payload: snapshot.payload,
        });
        const created = await this.repository.createForNotification({
          notificationId: snapshot.notificationId,
          template: event.template,
          payload: event.payload,
        });
        if (created) result.recovered += 1;
        else result.skipped += 1;
      } catch (error) {
        if (error instanceof ZodError) {
          await this.recordInvalidSnapshot(snapshot, result);
        } else {
          result.failed += 1;
        }
      }
    }
    return result;
  }

  private async recordInvalidSnapshot(
    snapshot: Parameters<
      PrismaEmailOutboxRepository['createInvalidEventTerminal']
    >[0],
    result: NotificationEmailReconciliationResult
  ): Promise<void> {
    try {
      if (await this.repository.createInvalidEventTerminal(snapshot)) {
        result.terminal += 1;
      } else {
        result.skipped += 1;
      }
    } catch {
      result.failed += 1;
    }
  }
}
