import { describe, expect, it } from 'vitest';
import {
  SIGNUP_CHECK_EMAIL_MESSAGE,
  isExistingAccountAuthError,
  isObfuscatedDuplicateSignup,
} from '@/lib/auth-existing-account';

describe('auth existing-account signup', () => {
  it('detects GoTrue obfuscated duplicate sign-up (empty identities)', () => {
    expect(isObfuscatedDuplicateSignup({ identities: [] })).toBe(true);
    expect(
      isObfuscatedDuplicateSignup({
        identities: [{ id: 'identity-1' }],
      })
    ).toBe(false);
    expect(isObfuscatedDuplicateSignup({ identities: null })).toBe(false);
  });

  it('detects Auth already-registered errors without using that copy in the UI', () => {
    expect(isExistingAccountAuthError('User already registered')).toBe(true);
    expect(isExistingAccountAuthError('Invalid login credentials')).toBe(false);
  });

  it('uses generic check-email copy that does not admit the address exists', () => {
    expect(SIGNUP_CHECK_EMAIL_MESSAGE).toBe(
      'If this email is valid, we sent a message with the next steps.'
    );
    expect(SIGNUP_CHECK_EMAIL_MESSAGE.toLowerCase()).not.toContain(
      'already exists'
    );
  });
});
