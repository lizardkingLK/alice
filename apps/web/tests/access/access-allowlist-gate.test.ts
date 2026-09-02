import { beforeEach, describe, expect, it, vi } from 'vitest';
import { evaluateEmailAdmission, isEmailAllowed } from '@/lib/access-allowlist';
import {
  createAdminClient,
  mockAllowlistLookupError,
  mockAllowlistRows,
} from '../mocks/supabase-admin';

vi.mock('@/lib/supabase/admin', () => import('../mocks/supabase-admin'));

describe('isEmailAllowed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns false without querying when the email is invalid', async () => {
    mockAllowlistRows({});

    const allowed = await isEmailAllowed('not-an-email');

    expect(allowed).toBe(false);
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it('allows when an active email row matches', async () => {
    mockAllowlistRows({
      'email:client@partner.com': { expires_at: null },
    });

    const allowed = await isEmailAllowed('Client@Partner.com');

    expect(allowed).toBe(true);
  });

  it('allows when only an active domain row matches', async () => {
    mockAllowlistRows({
      'domain:acme.com': { expires_at: null },
    });

    const allowed = await isEmailAllowed('user@acme.com');

    expect(allowed).toBe(true);
  });

  it('denies when matching rows are expired', async () => {
    mockAllowlistRows({
      'email:user@acme.com': { expires_at: '2020-01-01T00:00:00.000Z' },
      'domain:acme.com': { expires_at: '2020-01-01T00:00:00.000Z' },
    });

    const allowed = await isEmailAllowed('user@acme.com');

    expect(allowed).toBe(false);
  });

  it('denies when no allowlist rows match', async () => {
    mockAllowlistRows({});

    const allowed = await isEmailAllowed('outsider@gmail.com');

    expect(allowed).toBe(false);
  });

  it('throws when the allowlist lookup fails', async () => {
    mockAllowlistLookupError('db down');

    await expect(isEmailAllowed('user@acme.com')).rejects.toThrow(
      'Failed to check access allowlist'
    );
  });

  it('denies guest access when enforceGuestChecks is true and user does not exist', async () => {
    mockAllowlistRows({ 'email:guest@partner.com': { expires_at: null } }, {});

    const allowed = await isEmailAllowed('guest@partner.com', {
      enforceGuestChecks: true,
    });
    expect(allowed).toBe(false);
  });

  it('denies guest access when enforceGuestChecks is true and allowlist has no project keys', async () => {
    mockAllowlistRows(
      {
        'email:guest@partner.com': {
          expires_at: null,
          allowed_project_ids: [],
        },
      },
      { 'guest@partner.com': { id: 'user-guest' } }
    );

    const allowed = await isEmailAllowed('guest@partner.com', {
      enforceGuestChecks: true,
    });
    expect(allowed).toBe(false);
  });

  it('denies guest access when enforceGuestChecks is true and project keys do not match any project', async () => {
    mockAllowlistRows(
      {
        'email:guest@partner.com': {
          expires_at: null,
          allowed_project_ids: ['MISSING'],
        },
      },
      { 'guest@partner.com': { id: 'user-guest' } },
      []
    );

    const allowed = await isEmailAllowed('guest@partner.com', {
      enforceGuestChecks: true,
    });
    expect(allowed).toBe(false);
  });

  it('allows guest access when enforceGuestChecks is true and allowlist project keys resolve', async () => {
    mockAllowlistRows(
      {
        'email:guest@partner.com': {
          expires_at: null,
          allowed_project_ids: ['SG'],
        },
      },
      { 'guest@partner.com': { id: 'user-guest' } },
      [{ id: 'proj-1', key: 'SG' }]
    );

    const allowed = await isEmailAllowed('guest@partner.com', {
      enforceGuestChecks: true,
    });
    expect(allowed).toBe(true);
  });

  it('bypasses guest checks when enforceGuestChecks is false or unset', async () => {
    mockAllowlistRows({ 'email:guest@partner.com': { expires_at: null } }, {});

    const allowed = await isEmailAllowed('guest@partner.com');
    expect(allowed).toBe(true);
  });
});

describe('evaluateEmailAdmission', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns denied_or_expired when rows exist but are inactive or expired', async () => {
    mockAllowlistRows({
      'email:user@acme.com': {
        expires_at: '2020-01-01T00:00:00.000Z',
        status: 'active',
      },
    });

    const result = await evaluateEmailAdmission('user@acme.com');
    expect(result).toEqual({ allowed: false, reason: 'denied_or_expired' });
  });
});
