import { describe, expect, it } from 'vitest';
import { EmailTransportError } from '../../src/lib/email/email-transport';
import {
  buildEmailIdempotencyKey,
  calculateEmailBackoffMs,
  classifyEmailFailure,
} from '../../src/lib/email/email-delivery-policy';

describe('email delivery policy', () => {
  it('builds stable keys and rejects unsafe components', () => {
    expect(buildEmailIdempotencyKey('assignment', 'event-1')).toBe(
      'assignment:event-1'
    );
    expect(buildEmailIdempotencyKey('assignment', 'event-1')).toBe(
      buildEmailIdempotencyKey('assignment', 'event-1')
    );
    expect(() => buildEmailIdempotencyKey('bad:key', 'event-1')).toThrow();
  });

  it('calculates capped exponential backoff', () => {
    expect(calculateEmailBackoffMs(1)).toBe(60_000);
    expect(calculateEmailBackoffMs(4)).toBe(480_000);
    expect(calculateEmailBackoffMs(20, { baseMs: 1_000, maxMs: 10_000 })).toBe(
      10_000
    );
    expect(() => calculateEmailBackoffMs(0)).toThrow();
  });

  it('classifies provider and transport failures', () => {
    expect(
      classifyEmailFailure(
        new EmailTransportError('rate limited', { kind: 'http', status: 429 })
      ).action
    ).toBe('retry');
    expect(
      classifyEmailFailure(
        new EmailTransportError('bad recipient', {
          kind: 'http',
          status: 422,
        })
      ).action
    ).toBe('dead');
    expect(
      classifyEmailFailure(
        new EmailTransportError('timeout', { kind: 'timeout' })
      ).action
    ).toBe('retry');
    expect(classifyEmailFailure(new Error('socket reset')).action).toBe(
      'retry'
    );
  });
});
