import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isEmailAllowed } from '@/lib/access-allowlist';
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
    // Arrange
    mockAllowlistRows({});

    // Act
    const allowed = await isEmailAllowed('not-an-email');

    // Assert
    expect(allowed).toBe(false);
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it('allows when an active email row matches', async () => {
    // Arrange
    mockAllowlistRows({
      'email:client@partner.com': { expires_at: null },
    });

    // Act
    const allowed = await isEmailAllowed('Client@Partner.com');

    // Assert
    expect(allowed).toBe(true);
  });

  it('allows when only an active domain row matches', async () => {
    // Arrange
    mockAllowlistRows({
      'domain:acme.com': { expires_at: null },
    });

    // Act
    const allowed = await isEmailAllowed('user@acme.com');

    // Assert
    expect(allowed).toBe(true);
  });

  it('denies when matching rows are expired', async () => {
    // Arrange
    mockAllowlistRows({
      'email:user@acme.com': { expires_at: '2020-01-01T00:00:00.000Z' },
      'domain:acme.com': { expires_at: '2020-01-01T00:00:00.000Z' },
    });

    // Act
    const allowed = await isEmailAllowed('user@acme.com');

    // Assert
    expect(allowed).toBe(false);
  });

  it('denies when no allowlist rows match', async () => {
    // Arrange
    mockAllowlistRows({});

    // Act
    const allowed = await isEmailAllowed('outsider@gmail.com');

    // Assert
    expect(allowed).toBe(false);
  });

  it('throws when the allowlist lookup fails', async () => {
    // Arrange
    mockAllowlistLookupError('db down');

    // Act / Assert
    await expect(isEmailAllowed('user@acme.com')).rejects.toThrow(
      'Failed to check access allowlist'
    );
  });

  it('denies guest access when enforceGuestChecks is true and user does not exist', async () => {
    mockAllowlistRows(
      { 'email:guest@partner.com': { expires_at: null } },
      {}, // no user
      {}
    );

    const allowed = await isEmailAllowed('guest@partner.com', {
      enforceGuestChecks: true,
    });
    expect(allowed).toBe(false);
  });

  it('denies guest access when enforceGuestChecks is true and user exists but has 0 projects', async () => {
    mockAllowlistRows(
      { 'email:guest@partner.com': { expires_at: null } },
      { 'guest@partner.com': { id: 'user-guest' } },
      { 'user-guest': [] } // 0 projects
    );

    const allowed = await isEmailAllowed('guest@partner.com', {
      enforceGuestChecks: true,
    });
    expect(allowed).toBe(false);
  });

  it('allows guest access when enforceGuestChecks is true and user exists with projects', async () => {
    mockAllowlistRows(
      { 'email:guest@partner.com': { expires_at: null } },
      { 'guest@partner.com': { id: 'user-guest' } },
      { 'user-guest': [{ project_id: 'proj-1' }] } // 1 project
    );

    const allowed = await isEmailAllowed('guest@partner.com', {
      enforceGuestChecks: true,
    });
    expect(allowed).toBe(true);
  });

  it('bypasses guest checks when enforceGuestChecks is false or unset', async () => {
    mockAllowlistRows(
      { 'email:guest@partner.com': { expires_at: null } },
      {}, // no user
      {}
    );

    const allowed = await isEmailAllowed('guest@partner.com');
    expect(allowed).toBe(true);
  });
});
