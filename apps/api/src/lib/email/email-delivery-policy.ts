import { EmailTransportError } from './email-transport';

const SAFE_IDEMPOTENCY_COMPONENT = /^[A-Za-z0-9_-]{1,200}$/;

export type EmailFailureDisposition = {
  readonly action: 'retry' | 'dead';
  readonly code: string;
  readonly message: string;
};

export function buildEmailIdempotencyKey(
  eventKind: string,
  eventId: string
): string {
  if (
    !SAFE_IDEMPOTENCY_COMPONENT.test(eventKind) ||
    !SAFE_IDEMPOTENCY_COMPONENT.test(eventId)
  ) {
    throw new Error('Email idempotency components are invalid.');
  }
  return `${eventKind}:${eventId}`;
}

export function calculateEmailBackoffMs(
  completedAttemptCount: number,
  options: { readonly baseMs?: number; readonly maxMs?: number } = {}
): number {
  if (!Number.isInteger(completedAttemptCount) || completedAttemptCount < 1) {
    throw new Error('Completed attempt count must be a positive integer.');
  }
  const baseMs = options.baseMs ?? 60_000;
  const maxMs = options.maxMs ?? 12 * 60 * 60 * 1000;
  if (baseMs <= 0 || maxMs < baseMs) {
    throw new Error('Email backoff configuration is invalid.');
  }
  return Math.min(baseMs * 2 ** (completedAttemptCount - 1), maxMs);
}

export function classifyEmailFailure(error: unknown): EmailFailureDisposition {
  if (error instanceof EmailTransportError) {
    if (error.details.kind === 'configuration') {
      return { action: 'retry', code: 'configuration', message: error.message };
    }
    if (error.details.kind === 'timeout' || error.details.kind === 'network') {
      return {
        action: 'retry',
        code: error.details.kind,
        message: error.message,
      };
    }
    const status = error.details.status;
    const retryable =
      status === undefined ||
      [408, 409, 425, 429].includes(status) ||
      status >= 500;
    return {
      action: retryable ? 'retry' : 'dead',
      code: status ? `http_${status}` : 'http_unknown',
      message: error.message,
    };
  }

  return {
    action: 'retry',
    code: 'unknown',
    message: error instanceof Error ? error.message : 'Unknown email failure.',
  };
}
