import { describe, expect, it } from 'vitest';
import {
  LOGIN_DEACTIVATED_MESSAGE,
  LOGIN_INVALID_CREDENTIALS_MESSAGE,
  isInvalidLoginCredentialsError,
  loginErrorMessage,
} from '@/lib/auth-login-errors';

describe('loginErrorMessage', () => {
  it('maps Supabase ban errors to a deactivated message', () => {
    expect(loginErrorMessage('User is banned')).toBe(LOGIN_DEACTIVATED_MESSAGE);
  });

  it('maps invalid credentials to a generic message', () => {
    expect(loginErrorMessage('Invalid login credentials')).toBe(
      LOGIN_INVALID_CREDENTIALS_MESSAGE
    );
  });

  it('passes through other auth errors unchanged', () => {
    expect(loginErrorMessage('Email not confirmed')).toBe(
      'Email not confirmed'
    );
  });
});

describe('isInvalidLoginCredentialsError', () => {
  it('detects mapped and raw invalid-credential copy', () => {
    expect(
      isInvalidLoginCredentialsError(LOGIN_INVALID_CREDENTIALS_MESSAGE)
    ).toBe(true);
    expect(isInvalidLoginCredentialsError('Invalid login credentials')).toBe(
      true
    );
    expect(isInvalidLoginCredentialsError('Email not confirmed')).toBe(false);
  });
});
