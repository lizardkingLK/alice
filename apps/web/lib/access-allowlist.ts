import { createAdminClient } from '@/lib/supabase/admin';
import {
  emailDomainFromAddress,
  allowlistProjectKeysAreResolvable,
  RecordStatusEnum,
  type AccessDenialReason,
  type EmailAdmissionResult,
} from '@repo/types';

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

type AllowlistRowHit = {
  status: string;
  expires_at: string | null;
  allowed_project_ids: unknown;
};

async function findAllowlistRow(params: {
  kind: 'domain' | 'email';
  value: string;
}): Promise<AllowlistRowHit | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('access_allowlist')
    .select('status, expires_at, allowed_project_ids')
    .eq('kind', params.kind)
    .eq('value', params.value)
    .maybeSingle();

  if (error) {
    console.error('error. access allowlist lookup failed:', error.message);
    throw new Error('Failed to check access allowlist');
  }

  return data;
}

function isActiveAllowlistRow(row: AllowlistRowHit | null): boolean {
  return Boolean(
    row?.status === RecordStatusEnum.active &&
    !isAllowlistExpired(row.expires_at)
  );
}

function hasDeniedOrExpiredRow(
  emailRow: AllowlistRowHit | null,
  domainRow: AllowlistRowHit | null
): boolean {
  const candidates = [emailRow, domainRow].filter(Boolean) as AllowlistRowHit[];
  if (candidates.length === 0) {
    return false;
  }

  return candidates.every(
    (row) =>
      row.status !== RecordStatusEnum.active ||
      isAllowlistExpired(row.expires_at)
  );
}

async function guestHasWhitelistedProjects(
  allowedProjectIds: unknown
): Promise<boolean> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from('projects').select('id, key');

  if (error) {
    console.error(
      'error. guest allowlist project lookup failed:',
      error.message
    );
    return false;
  }

  return allowlistProjectKeysAreResolvable(allowedProjectIds, data ?? []);
}

async function runGuestAdmissionChecks(
  normalizedEmail: string,
  emailRow: AllowlistRowHit
): Promise<EmailAdmissionResult> {
  const supabase = createAdminClient();

  const { data: userRecord, error: userError } = await supabase
    .from('users')
    .select('id')
    .eq('email', normalizedEmail)
    .maybeSingle();

  if (userError || !userRecord) {
    console.warn(
      'Guest access denied: User record does not exist for email:',
      normalizedEmail
    );
    return { allowed: false, reason: 'guest_user_missing' };
  }

  const hasProjects = await guestHasWhitelistedProjects(
    emailRow.allowed_project_ids
  );
  if (!hasProjects) {
    console.warn(
      'Guest access denied: No whitelisted projects configured:',
      normalizedEmail
    );
    return { allowed: false, reason: 'no_guest_projects' };
  }

  return { allowed: true };
}

/**
 * Admission check against `access_allowlist`.
 * Domain rows admit without project-key checks; email rows require
 * whitelisted project keys (not `project_members`).
 */
export async function evaluateEmailAdmission(
  email: string,
  options?: { enforceGuestChecks?: boolean }
): Promise<EmailAdmissionResult> {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    return { allowed: false, reason: 'not_allowlisted' };
  }

  const domain = extractEmailDomain(normalized);
  if (!domain) {
    return { allowed: false, reason: 'not_allowlisted' };
  }

  const [emailRow, domainRow] = await Promise.all([
    findAllowlistRow({ kind: 'email', value: normalized }),
    findAllowlistRow({ kind: 'domain', value: domain }),
  ]);

  if (isActiveAllowlistRow(domainRow)) {
    return { allowed: true };
  }

  if (emailRow && isActiveAllowlistRow(emailRow)) {
    if (!options?.enforceGuestChecks) {
      return { allowed: true };
    }
    return runGuestAdmissionChecks(normalized, emailRow);
  }

  if (hasDeniedOrExpiredRow(emailRow, domainRow)) {
    return { allowed: false, reason: 'denied_or_expired' };
  }

  return { allowed: false, reason: 'not_allowlisted' };
}

/** @deprecated Prefer `evaluateEmailAdmission` when a denial reason is needed. */
export async function isEmailAllowed(
  email: string,
  options?: { enforceGuestChecks?: boolean }
): Promise<boolean> {
  const result = await evaluateEmailAdmission(email, options);
  return result.allowed;
}

export function accessDenialReasonToQueryParam(
  reason: AccessDenialReason
): string | null {
  if (reason === 'denied_or_expired') {
    return 'denied_or_expired';
  }
  return null;
}

export function buildAccessDeniedPath(
  reason?: AccessDenialReason | null
): string {
  const param = reason ? accessDenialReasonToQueryParam(reason) : null;
  if (!param) {
    return '/access-denied';
  }
  return `/access-denied?reason=${param}`;
}
