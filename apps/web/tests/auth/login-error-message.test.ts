import { describe, expect, it } from 'vitest';
import { loginErrorMessage } from '@/lib/auth-login-errors';

describe('loginErrorMessage', () => {
  it('maps Supabase ban errors to a deactivated message', () => {
    expect(loginErrorMessage('User is banned')).toBe(
      'Your account has been deactivated. Contact your administrator for access.'
    );
  });

  it('passes through other auth errors unchanged', () => {
    expect(loginErrorMessage('Invalid login credentials')).toBe(
      'Invalid login credentials'
    );
  });
});
