import {
  emailDomainFromAddress,
  getAccessAllowlistDisplayStatus,
  isAllowlistExpired,
  normalizeAccessAllowlistDomain,
} from '@repo/types';

export type CoveringDomainAllowlist = {
  readonly id: string;
  readonly value: string;
  readonly label: string | null;
  readonly status: string;
  readonly expires_at: string | null;
  readonly updated_at: string;
};

/** Domain row for the requester email, if any (any stored status). */
export function findCoveringDomainEntry<T extends CoveringDomainAllowlist>(
  email: string,
  domainEntries: readonly T[]
): T | null {
  const domain = emailDomainFromAddress(email);
  if (!domain || domainEntries.length === 0) {
    return null;
  }
  return (
    domainEntries.find(
      (entry) => normalizeAccessAllowlistDomain(entry.value) === domain
    ) ?? null
  );
}

/** Admission-effective: stored active and not past expires_at. */
export function isDomainEffectivelyActive(
  entry: Pick<CoveringDomainAllowlist, 'status' | 'expires_at'>,
  now: Date = new Date()
): boolean {
  return (
    getAccessAllowlistDisplayStatus(entry.status, entry.expires_at, now) ===
    'active'
  );
}

/**
 * Member-locked grant path: covering domain exists and is admission-effective
 * (or was just renewed in-dialog).
 */
export function isGrantMemberLocked(
  email: string,
  domainEntries: readonly CoveringDomainAllowlist[],
  now: Date = new Date()
): boolean {
  const covering = findCoveringDomainEntry(email, domainEntries);
  if (!covering) {
    return false;
  }
  return isDomainEffectivelyActive(covering, now);
}

/** True when a covering domain exists but cannot admit (expired or inactive). */
export function needsDomainRenewBeforeGrant(
  entry: Pick<CoveringDomainAllowlist, 'status' | 'expires_at'> | null,
  now: Date = new Date()
): boolean {
  if (!entry) {
    return false;
  }
  return !isDomainEffectivelyActive(entry, now);
}

export function toAllowlistDateInputValue(iso: string | null): string {
  if (!iso) {
    return '';
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toISOString().slice(0, 10);
}

export function fromAllowlistDateInputValue(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const date = new Date(`${trimmed}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString();
}

export type DomainRenewValidation =
  | { readonly ok: true; readonly expiresAt: string }
  | { readonly ok: false; readonly message: string };

/**
 * Client gate before grant: status Active + expires strictly after today (UTC date).
 */
export function validateDomainRenewForGrant(params: {
  readonly status: string;
  readonly expiresAtInput: string;
  readonly now?: Date;
}): DomainRenewValidation {
  if (params.status !== 'active') {
    return {
      ok: false,
      message: 'Status must be Active before you can grant access.',
    };
  }

  const trimmed = params.expiresAtInput.trim();
  if (!trimmed) {
    return {
      ok: false,
      message: 'Expires on must be a date after today.',
    };
  }

  const now = params.now ?? new Date();
  const todayUtc = now.toISOString().slice(0, 10);
  if (trimmed <= todayUtc) {
    return {
      ok: false,
      message: 'Expires on must be a date after today.',
    };
  }

  const expiresAt = fromAllowlistDateInputValue(trimmed);
  if (!expiresAt || isAllowlistExpired(expiresAt, now)) {
    return {
      ok: false,
      message: 'Expires on must be a date after today.',
    };
  }

  return { ok: true, expiresAt };
}
