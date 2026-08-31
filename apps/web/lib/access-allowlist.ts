import { createAdminClient } from '@/lib/supabase/admin';
import { emailDomainFromAddress, RecordStatusEnum } from '@repo/types';

/**
 * Paths that do not require an allowlisted identity.
 * Auth handlers under `/auth/*` are included via prefix.
 */
const PUBLIC_ACCESS_PATHS = new Set([
  '/',
  '/about',
  '/contact',
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/access-denied',
]);

/**
 * True when the path may be visited without an allowlisted email
 * (marketing, auth forms, recovery, access-denied, auth callbacks).
 */
export function isPublicAccessPath(pathname: string): boolean {
  if (PUBLIC_ACCESS_PATHS.has(pathname)) {
    return true;
  }

  return pathname === '/auth' || pathname.startsWith('/auth/');
}

/**
 * Normalize an email for allowlist matching: trim + lowercase.
 * Returns null when the value is empty or has no `@domain` part.
 */
export function normalizeEmail(email: string): string | null {
  const normalized = email.trim().toLowerCase();
  const parts = normalized.split('@');
  if (parts.length !== 2) {
    return null;
  }

  const [local, domain] = parts;
  if (!local || !domain) {
    return null;
  }

  return `${local}@${domain}`;
}

/**
 * Domain part of a normalized email (`user@Acme.COM` → `acme.com`).
 * Strips a leading `@` if present on bare domain inputs.
 */
export function extractEmailDomain(email: string): string | null {
  return emailDomainFromAddress(email);
}

/** True when `expires_at` is set and not after `now`. */
export function isAllowlistExpired(
  expiresAt: string | null | undefined,
  now: Date = new Date()
): boolean {
  if (expiresAt == null || expiresAt === '') {
    return false;
  }

  const expires = new Date(expiresAt);
  if (Number.isNaN(expires.getTime())) {
    return true;
  }

  return expires.getTime() <= now.getTime();
}

type AllowlistHit = {
  expires_at: string | null;
};

async function findActiveAllowlistHit(params: {
  kind: 'domain' | 'email';
  value: string;
}): Promise<AllowlistHit | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('access_allowlist')
    .select('expires_at')
    .eq('status', 'active')
    .eq('kind', params.kind)
    .eq('value', params.value)
    .maybeSingle();

  if (error) {
    console.error('error. access allowlist lookup failed:', error.message);
    throw new Error('Failed to check access allowlist');
  }

  return data;
}

/**
 * Admission check against `access_allowlist`.
 * Allows when an active, non-expired **email** row or **domain** row matches.
 * Uses the service-role client (server-only) — do not call from the browser.
 */
export async function isEmailAllowed(
  email: string,
  options?: { enforceGuestChecks?: boolean }
): Promise<boolean> {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    return false;
  }

  const domain = extractEmailDomain(normalized);
  if (!domain) {
    return false;
  }

  const [emailHit, domainHit] = await Promise.all([
    findActiveAllowlistHit({ kind: 'email', value: normalized }),
    findActiveAllowlistHit({ kind: 'domain', value: domain }),
  ]);

  let isAllowed = false;
  let isGuest = false;

  if (emailHit && !isAllowlistExpired(emailHit.expires_at)) {
    isAllowed = true;
    isGuest = true;
  } else if (domainHit && !isAllowlistExpired(domainHit.expires_at)) {
    isAllowed = true;
  }

  if (!isAllowed) {
    return false;
  }

  if (isGuest && options?.enforceGuestChecks) {
    const supabase = createAdminClient();

    // 1. "An allowlisted email must belong to an existing user."
    const { data: userRecord, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('email', normalized)
      .maybeSingle();

    if (userError || !userRecord) {
      console.warn(
        'Guest access denied: User record does not exist for email:',
        normalized
      );
      return false;
    }

    // 2. "That user must have 1 or more projects configured."
    const { data: memberships, error: memberError } = await supabase
      .from('project_members')
      .select('project_id')
      .eq('user_id', userRecord.id)
      .eq('status', RecordStatusEnum.active);

    if (memberError || !memberships || memberships.length === 0) {
      console.warn(
        'Guest access denied: User has 0 projects configured:',
        normalized
      );
      return false;
    }
  }

  return true;
}
