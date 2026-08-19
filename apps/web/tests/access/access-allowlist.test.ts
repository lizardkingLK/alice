import { describe, it, expect, vi } from 'vitest';
import {
  extractEmailDomain,
  isAllowlistExpired,
  isPublicAccessPath,
  normalizeEmail,
} from '@/lib/access-allowlist';
import {
  isActorOwnAllowlistDomain,
  isOwnAllowlistDomainLockout,
} from '@repo/types';

vi.mock('@/lib/supabase/admin', () => import('../mocks/supabase-admin'));

describe('isPublicAccessPath', () => {
  it.each([
    '/',
    '/about',
    '/contact',
    '/login',
    '/signup',
    '/forgot-password',
    '/reset-password',
    '/access-denied',
    '/auth',
    '/auth/callback',
  ])('treats %s as public', (pathname) => {
    // Arrange / Act / Assert
    expect(isPublicAccessPath(pathname)).toBe(true);
  });

  it.each(['/dashboard', '/users', '/board', '/work-items'])(
    'treats %s as protected',
    (pathname) => {
      expect(isPublicAccessPath(pathname)).toBe(false);
    }
  );
});

describe('normalizeEmail', () => {
  it('trims and lowercases a valid email', () => {
    // Arrange
    const raw = '  User@SomeOrgName.com ';

    // Act
    const normalized = normalizeEmail(raw);

    // Assert
    expect(normalized).toBe('user@someorgname.com');
  });

  it.each(['', '   ', 'not-an-email', '@missing-local.com', 'missing-domain@'])(
    'returns null for invalid email %j',
    (raw) => {
      expect(normalizeEmail(raw)).toBeNull();
    }
  );

  it('returns null when more than one @ is present', () => {
    expect(normalizeEmail('a@b@c.com')).toBeNull();
  });
});

describe('extractEmailDomain', () => {
  it('returns the domain from a mixed-case email', () => {
    expect(extractEmailDomain('User@Acme.COM')).toBe('acme.com');
  });

  it('returns null for an invalid email', () => {
    expect(extractEmailDomain('not-an-email')).toBeNull();
  });
});

describe('isActorOwnAllowlistDomain', () => {
  it('is true for a domain row matching the actor email', () => {
    expect(
      isActorOwnAllowlistDomain(
        { kind: 'domain', value: 'Alice.dev' },
        'admin@alice.dev'
      )
    ).toBe(true);
  });

  it('is false for email rows and other domains', () => {
    expect(
      isActorOwnAllowlistDomain(
        { kind: 'email', value: 'admin@alice.dev' },
        'admin@alice.dev'
      )
    ).toBe(false);
    expect(
      isActorOwnAllowlistDomain(
        { kind: 'domain', value: 'partner.com' },
        'admin@alice.dev'
      )
    ).toBe(false);
  });
});

describe('isOwnAllowlistDomainLockout', () => {
  const ownDomain = { kind: 'domain', value: 'alice.dev' };

  it('is true when deleting the actor own domain', () => {
    expect(
      isOwnAllowlistDomainLockout({
        entry: ownDomain,
        actorEmail: 'admin@alice.dev',
        deleting: true,
      })
    ).toBe(true);
  });

  it('is true when setting the actor own domain inactive', () => {
    expect(
      isOwnAllowlistDomainLockout({
        entry: ownDomain,
        actorEmail: 'admin@alice.dev',
        nextStatus: 'inactive',
      })
    ).toBe(true);
  });

  it('is false when the actor own domain stays active', () => {
    expect(
      isOwnAllowlistDomainLockout({
        entry: ownDomain,
        actorEmail: 'admin@alice.dev',
        nextStatus: 'active',
      })
    ).toBe(false);
  });
});

describe('isAllowlistExpired', () => {
  const now = new Date('2026-07-15T12:00:00.000Z');

  it('treats null and empty expiry as never expired', () => {
    expect(isAllowlistExpired(null, now)).toBe(false);
    expect(isAllowlistExpired('', now)).toBe(false);
    expect(isAllowlistExpired(undefined, now)).toBe(false);
  });

  it('treats a past expiry as expired', () => {
    expect(isAllowlistExpired('2026-07-01T00:00:00.000Z', now)).toBe(true);
  });

  it('treats an expiry equal to now as expired', () => {
    expect(isAllowlistExpired(now.toISOString(), now)).toBe(true);
  });

  it('treats a future expiry as not expired', () => {
    expect(isAllowlistExpired('2026-08-01T00:00:00.000Z', now)).toBe(false);
  });

  it('treats an invalid date string as expired', () => {
    expect(isAllowlistExpired('not-a-date', now)).toBe(true);
  });
});
