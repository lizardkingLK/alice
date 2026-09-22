import { describe, expect, it } from 'vitest';
import {
  SESSION_EXPIRED_MESSAGE,
  SessionExpiredError,
  isSessionExpiredError,
} from '@/lib/errors/session-expired';

describe('isSessionExpiredError', () => {
  it('recognizes SessionExpiredError instances', () => {
    expect(isSessionExpiredError(new SessionExpiredError('/login'))).toBe(true);
  });

  it('recognizes errors with the session-expired message', () => {
    expect(isSessionExpiredError(new Error(SESSION_EXPIRED_MESSAGE))).toBe(
      true
    );
  });

  it('rejects unrelated errors', () => {
    expect(isSessionExpiredError(new Error('Request failed'))).toBe(false);
    expect(isSessionExpiredError(null)).toBe(false);
  });
});
