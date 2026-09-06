import { describe, expect, it } from 'vitest';
import {
  buildCheckEmailPath,
  buildLoginPath,
  resolveSafeRedirectPath,
} from '@/lib/auth-redirect';

describe('buildCheckEmailPath', () => {
  it('includes email and next when provided', () => {
    expect(
      buildCheckEmailPath({ email: ' guest@x.com ', next: '/dashboard' })
    ).toBe('/check-email?email=guest%40x.com&next=%2Fdashboard');
  });

  it('returns the bare path when no options are set', () => {
    expect(buildCheckEmailPath()).toBe('/check-email');
  });
});

describe('resolveSafeRedirectPath', () => {
  it('rejects check-email as a next destination', () => {
    expect(resolveSafeRedirectPath('/check-email')).toBe('/dashboard');
  });
});

describe('buildLoginPath', () => {
  it('encodes invalid-credentials errors for the login page', () => {
    expect(buildLoginPath(null, { error: 'Invalid email or password.' })).toBe(
      '/login?error=Invalid+email+or+password.'
    );
  });
});
