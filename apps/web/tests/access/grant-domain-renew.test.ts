import { describe, expect, it } from 'vitest';
import {
  findCoveringDomainEntry,
  isDomainEffectivelyActive,
  needsDomainRenewBeforeGrant,
  validateDomainRenewForGrant,
} from '@/lib/access-requests/grant-domain-renew';

const BASE = {
  id: 'd1',
  value: 'partner.com',
  label: 'Partner',
  updated_at: '2026-01-01T00:00:00.000Z',
};

describe('findCoveringDomainEntry', () => {
  it('matches requester email domain case-insensitively', () => {
    expect(
      findCoveringDomainEntry('guest@Partner.COM', [
        { ...BASE, status: 'active', expires_at: null },
      ])?.id
    ).toBe('d1');
  });
});

describe('isDomainEffectivelyActive / needsDomainRenewBeforeGrant', () => {
  const now = new Date('2026-10-27T12:00:00.000Z');

  it('treats active non-expired as effective', () => {
    const entry = {
      ...BASE,
      status: 'active',
      expires_at: '2026-12-01T00:00:00.000Z',
    };
    expect(isDomainEffectivelyActive(entry, now)).toBe(true);
    expect(needsDomainRenewBeforeGrant(entry, now)).toBe(false);
  });

  it('requires renew for display-expired active rows', () => {
    const entry = {
      ...BASE,
      status: 'active',
      expires_at: '2026-10-01T00:00:00.000Z',
    };
    expect(isDomainEffectivelyActive(entry, now)).toBe(false);
    expect(needsDomainRenewBeforeGrant(entry, now)).toBe(true);
  });

  it('requires renew for inactive rows', () => {
    const entry = {
      ...BASE,
      status: 'inactive',
      expires_at: '2027-01-01T00:00:00.000Z',
    };
    expect(needsDomainRenewBeforeGrant(entry, now)).toBe(true);
  });
});

describe('validateDomainRenewForGrant', () => {
  const now = new Date('2026-10-27T12:00:00.000Z');

  it('requires active status and a date after today', () => {
    expect(
      validateDomainRenewForGrant({
        status: 'inactive',
        expiresAtInput: '2026-11-01',
        now,
      }).ok
    ).toBe(false);

    expect(
      validateDomainRenewForGrant({
        status: 'active',
        expiresAtInput: '2026-10-27',
        now,
      }).ok
    ).toBe(false);

    const ok = validateDomainRenewForGrant({
      status: 'active',
      expiresAtInput: '2026-10-28',
      now,
    });
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.expiresAt).toBe('2026-10-28T00:00:00.000Z');
    }
  });
});
