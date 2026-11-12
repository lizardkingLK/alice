import type {
  EmailMessage,
  EmailTransport,
} from '../../../lib/email/email-transport';
import {
  calculateEmailBackoffMs,
  classifyEmailFailure,
} from '../../../lib/email/email-delivery-policy';

export type ClaimedEmailOutboxItem = {
  readonly id: string;
  readonly notificationId: string | null;
  readonly userId: string | null;
  readonly recipientEmail: string;
  readonly template: string;
  readonly payload: unknown;
  readonly idempotencyKey: string;
  readonly attemptCount: number;
  readonly maxAttempts: number;
};

type LeaseTransition = {
  readonly id: string;
  readonly workerId: string;
};

export interface EmailOutboxRepository {
  /**
   * Atomically claims eligible rows and leases them to workerId. Storage must
   * also make expired processing leases eligible for a later claim.
   */
  claimBatch(input: {
    readonly workerId: string;
    readonly limit: number;
    readonly now: Date;
    readonly leaseUntil: Date;
  }): Promise<readonly ClaimedEmailOutboxItem[]>;
  renewLease(
    input: LeaseTransition & { readonly now: Date; readonly leaseUntil: Date }
  ): Promise<boolean>;
  shouldDeliver(item: ClaimedEmailOutboxItem): Promise<boolean>;
  markSent(
    input: LeaseTransition & { readonly sentAt: Date }
  ): Promise<boolean>;
  markRetry(
    input: LeaseTransition & {
      readonly attemptCount: number;
      readonly nextAttemptAt: Date;
      readonly errorCode: string;
      readonly errorMessage: string;
    }
  ): Promise<boolean>;
  markCancelled(
    input: LeaseTransition & {
      readonly cancelledAt: Date;
      readonly reason: string;
    }
  ): Promise<boolean>;
  markDead(
    input: LeaseTransition & {
      readonly attemptCount: number;
      readonly failedAt: Date;
      readonly errorCode: string;
      readonly errorMessage: string;
    }
  ): Promise<boolean>;
}

export interface OutboxEmailFactory {
  build(item: ClaimedEmailOutboxItem): EmailMessage;
}

export type EmailOutboxProcessorResult = {
  readonly claimed: number;
  readonly sent: number;
  readonly retried: number;
  readonly cancelled: number;
  readonly dead: number;
  readonly duplicateClaims: number;
  readonly leaseLost: number;
};

type MutableProcessorResult = {
  -readonly [
    Key in keyof EmailOutboxProcessorResult
  ]: EmailOutboxProcessorResult[Key];
};

function safeErrorMessage(message: string): string {
  return message.replace(/[\r\n\t]+/g, ' ').slice(0, 500);
}

export class EmailOutboxProcessor {
  constructor(
    private readonly repository: EmailOutboxRepository,
    private readonly transport: EmailTransport,
    private readonly emailFactory: OutboxEmailFactory,
    private readonly options: {
      readonly workerId: string;
      readonly batchSize?: number;
      readonly leaseDurationMs?: number;
      readonly now?: () => Date;
    }
  ) {}

  async processBatch(): Promise<EmailOutboxProcessorResult> {
    const now = this.options.now?.() ?? new Date();
    const leaseDurationMs = this.options.leaseDurationMs ?? 60_000;
    const items = await this.repository.claimBatch({
      workerId: this.options.workerId,
      limit: this.options.batchSize ?? 25,
      now,
      leaseUntil: new Date(now.getTime() + leaseDurationMs),
    });
    const result: MutableProcessorResult = {
      claimed: items.length,
      sent: 0,
      retried: 0,
      cancelled: 0,
      dead: 0,
      duplicateClaims: 0,
      leaseLost: 0,
    };
    const processedIds = new Set<string>();

    for (const item of items) {
      if (processedIds.has(item.id)) {
        result.duplicateClaims += 1;
        continue;
      }
      processedIds.add(item.id);
      await this.processItem(item, result);
    }

    return result;
  }

  private async processItem(
    item: ClaimedEmailOutboxItem,
    result: MutableProcessorResult
  ): Promise<void> {
    try {
      const leaseNow = this.options.now?.() ?? new Date();
      const ownsLease = await this.repository.renewLease({
        id: item.id,
        workerId: this.options.workerId,
        now: leaseNow,
        leaseUntil: new Date(
          leaseNow.getTime() + (this.options.leaseDurationMs ?? 60_000)
        ),
      });
      if (!ownsLease) {
        result.leaseLost += 1;
        return;
      }

      if (!(await this.repository.shouldDeliver(item))) {
        await this.recordTransition(
          this.repository.markCancelled({
            id: item.id,
            workerId: this.options.workerId,
            cancelledAt: this.options.now?.() ?? new Date(),
            reason: 'email_preference_disabled',
          }),
          result,
          'cancelled'
        );
        return;
      }

      await this.transport.send(this.emailFactory.build(item));
      await this.recordTransition(
        this.repository.markSent({
          id: item.id,
          workerId: this.options.workerId,
          sentAt: this.options.now?.() ?? new Date(),
        }),
        result,
        'sent'
      );
    } catch (error) {
      await this.recordFailure(item, error, result);
    }
  }

  private async recordFailure(
    item: ClaimedEmailOutboxItem,
    error: unknown,
    result: MutableProcessorResult
  ): Promise<void> {
    const failure = classifyEmailFailure(error);
    const attemptCount = item.attemptCount + 1;
    const errorMessage = safeErrorMessage(failure.message);
    const exhausted = attemptCount >= item.maxAttempts;
    if (failure.action === 'dead' || exhausted) {
      await this.recordTransition(
        this.repository.markDead({
          id: item.id,
          workerId: this.options.workerId,
          attemptCount,
          failedAt: this.options.now?.() ?? new Date(),
          errorCode: exhausted ? 'attempts_exhausted' : failure.code,
          errorMessage,
        }),
        result,
        'dead'
      );
      return;
    }

    const failedAt = this.options.now?.() ?? new Date();
    await this.recordTransition(
      this.repository.markRetry({
        id: item.id,
        workerId: this.options.workerId,
        attemptCount,
        nextAttemptAt: new Date(
          failedAt.getTime() + calculateEmailBackoffMs(attemptCount)
        ),
        errorCode: failure.code,
        errorMessage,
      }),
      result,
      'retried'
    );
  }

  private async recordTransition(
    transition: Promise<boolean>,
    result: MutableProcessorResult,
    key: 'sent' | 'retried' | 'cancelled' | 'dead'
  ): Promise<void> {
    if (await transition) {
      result[key] += 1;
    } else {
      result.leaseLost += 1;
    }
  }
}
