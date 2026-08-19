import { beforeEach, describe, expect, it, vi } from 'vitest';

const { inviteUserByEmailMock, signInWithOtpMock } = vi.hoisted(() => ({
  inviteUserByEmailMock: vi.fn(),
  signInWithOtpMock: vi.fn(),
}));

vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    auth: {
      admin: {
        inviteUserByEmail: inviteUserByEmailMock,
      },
      signInWithOtp: signInWithOtpMock,
    },
  },
}));

vi.mock('../../src/config/env', () => ({
  env: { FRONTEND_URL: 'https://alice.example' },
}));

import {
  buildAllowlistAuthRedirect,
  isExistingAuthUserError,
  notifyAllowlistedEmail,
} from '../../src/routes/api/accessAllowlist/notify-allowlisted-email';

describe('notifyAllowlistedEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    inviteUserByEmailMock.mockResolvedValue({ error: null });
    signInWithOtpMock.mockResolvedValue({ error: null });
  });

  it('builds the Auth callback redirect for invite and magic-link emails', () => {
    expect(
      buildAllowlistAuthRedirect('https://alice.example/', '/dashboard')
    ).toBe('https://alice.example/auth/callback?next=%2Fdashboard');
  });

  it('sends an invite email for a new address', async () => {
    await notifyAllowlistedEmail('client@partner.com');

    expect(inviteUserByEmailMock).toHaveBeenCalledWith('client@partner.com', {
      redirectTo: 'https://alice.example/auth/callback?next=%2Freset-password',
    });
    expect(signInWithOtpMock).not.toHaveBeenCalled();
  });

  it('falls back to a magic link when Auth already has the user', async () => {
    inviteUserByEmailMock.mockResolvedValue({
      error: { message: 'User already registered' },
    });

    await notifyAllowlistedEmail('client@partner.com');

    expect(signInWithOtpMock).toHaveBeenCalledWith({
      email: 'client@partner.com',
      options: {
        shouldCreateUser: false,
        emailRedirectTo:
          'https://alice.example/auth/callback?next=%2Fdashboard',
      },
    });
  });

  it('does not throw when the invite mailer fails for another reason', async () => {
    inviteUserByEmailMock.mockResolvedValue({
      error: { message: 'SMTP unavailable' },
    });

    await expect(
      notifyAllowlistedEmail('client@partner.com')
    ).resolves.toBeUndefined();
    expect(signInWithOtpMock).not.toHaveBeenCalled();
  });

  it('detects existing-account Auth errors', () => {
    expect(isExistingAuthUserError('User already registered')).toBe(true);
    expect(isExistingAuthUserError('SMTP unavailable')).toBe(false);
  });
});
