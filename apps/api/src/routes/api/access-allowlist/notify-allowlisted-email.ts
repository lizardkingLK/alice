import { env } from '../../../config/env';
import { supabase } from '../../../lib/supabase';

export function isExistingAuthUserError(message: string): boolean {
  return /already registered|already exists|user already/i.test(message);
}

export function buildAllowlistAuthRedirect(
  frontendUrl: string,
  nextPath: string
): string {
  const origin = frontendUrl.replace(/\/$/, '');
  return `${origin}/auth/callback?next=${encodeURIComponent(nextPath)}`;
}

/**
 * Emails a newly allowlisted address using the Auth mailer (no extra SMTP).
 * New addresses get the Invite template (set password). Addresses already in
 * Auth get a magic link so they can sign in now that admission is granted.
 * Failures are logged and never thrown — the allowlist row must still persist.
 */
export async function notifyAllowlistedEmail(email: string): Promise<void> {
  const inviteRedirectTo = buildAllowlistAuthRedirect(
    env.FRONTEND_URL,
    '/reset-password'
  );

  const { error: inviteError } = await supabase.auth.admin.inviteUserByEmail(
    email,
    { redirectTo: inviteRedirectTo }
  );

  if (!inviteError) {
    return;
  }

  if (!isExistingAuthUserError(inviteError.message)) {
    console.error('error. allowlist invite email failed:', inviteError.message);
    return;
  }

  const { error: otpError } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: buildAllowlistAuthRedirect(
        env.FRONTEND_URL,
        '/dashboard'
      ),
    },
  });

  if (otpError) {
    console.error('error. allowlist sign-in email failed:', otpError.message);
  }
}
