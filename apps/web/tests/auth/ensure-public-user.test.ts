import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '@supabase/supabase-js';
import {
  ensurePublicUser,
  promoteMembershipIfReady,
} from '@/lib/ensure-public-user';
import { createAdminClient } from '../mocks/supabase-admin';

vi.mock('@/lib/supabase/admin', () => import('../mocks/supabase-admin'));

type UsersLookup = {
  id?: { id: string } | null;
  email?: { id: string } | null;
};

type UsersAdminOptions = {
  existing?: UsersLookup;
  insertError?: { code?: string; message: string } | null;
  updateResult?: { id: string } | null;
  updateError?: { message: string } | null;
};

function existingRowForColumn(
  column: string,
  existing?: UsersLookup
): { id: string } | null {
  if (column === 'id') {
    return existing?.id ?? null;
  }
  if (column === 'email') {
    return existing?.email ?? null;
  }
  return null;
}

function createUsersAdminClient(options: UsersAdminOptions) {
  const insert = vi.fn().mockResolvedValue({
    data: null,
    error: options.insertError ?? null,
  });

  const updateChain = {
    eq: vi.fn(() => updateChain),
    select: vi.fn(() => updateChain),
    maybeSingle: vi.fn(async () => ({
      data: options.updateResult ?? null,
      error: options.updateError ?? null,
    })),
  };
  const update = vi.fn(() => updateChain);

  let column = '';
  const filterChain = {
    eq: vi.fn((nextColumn: string) => {
      column = nextColumn;
      return filterChain;
    }),
    maybeSingle: vi.fn(async () => ({
      data: existingRowForColumn(column, options.existing),
      error: null,
    })),
  };

  return {
    insert,
    update,
    from: vi.fn(() => ({
      select: vi.fn(() => filterChain),
      insert,
      update,
    })),
  };
}

function mockUsersAdmin(options: UsersAdminOptions) {
  const { insert, update, from } = createUsersAdminClient(options);
  createAdminClient.mockImplementation(() => ({ from }));
  return { insert, update };
}

function authUser(overrides: Partial<User> = {}): User {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'alex@acme.com',
    app_metadata: {},
    user_metadata: { name: 'Alex' },
    aud: 'authenticated',
    created_at: '2026-01-01T00:00:00.000Z',
    email_confirmed_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  } as User;
}

describe('ensurePublicUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not insert when a profile already exists for the Auth id', async () => {
    const { insert, update } = mockUsersAdmin({
      existing: { id: { id: '11111111-1111-4111-8111-111111111111' } },
      updateResult: null,
    });

    const result = await ensurePublicUser(authUser());

    expect(result).toEqual({ created: false, error: null });
    expect(insert).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalled();
  });

  it('does not insert when the email already has a profile (duplicate sign-up)', async () => {
    const { insert } = mockUsersAdmin({
      existing: {
        id: null,
        email: { id: '22222222-2222-4222-8222-222222222222' },
      },
    });

    const result = await ensurePublicUser(authUser());

    expect(result).toEqual({ created: false, error: null });
    expect(insert).not.toHaveBeenCalled();
  });

  it('swallows unique/primary-key races instead of returning the Postgres error', async () => {
    mockUsersAdmin({
      existing: { id: null, email: null },
      insertError: {
        code: '23505',
        message: 'duplicate key value violates unique constraint "users_pkey"',
      },
      updateResult: null,
    });

    const result = await ensurePublicUser(authUser());

    expect(result).toEqual({ created: false, error: null });
  });

  it('inserts a membership-active profile when Auth email is confirmed', async () => {
    const { insert } = mockUsersAdmin({
      existing: { id: null, email: null },
    });

    const result = await ensurePublicUser(authUser());

    expect(result).toEqual({ created: true, error: null });
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        membership_status: 'active',
        active: true,
      })
    );
  });

  it('inserts pending membership when Auth email is not confirmed', async () => {
    const { insert } = mockUsersAdmin({
      existing: { id: null, email: null },
    });

    const result = await ensurePublicUser(
      authUser({ email_confirmed_at: undefined })
    );

    expect(result).toEqual({ created: true, error: null });
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        membership_status: 'pending',
      })
    );
  });
});

describe('promoteMembershipIfReady', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('no-ops when Auth email is not confirmed', async () => {
    const { update } = mockUsersAdmin({});

    const result = await promoteMembershipIfReady(
      authUser({ email_confirmed_at: undefined })
    );

    expect(result).toEqual({ promoted: false, error: null });
    expect(update).not.toHaveBeenCalled();
  });

  it('promotes pending row when Auth is confirmed', async () => {
    const { update } = mockUsersAdmin({
      updateResult: { id: '11111111-1111-4111-8111-111111111111' },
    });

    const result = await promoteMembershipIfReady(authUser());

    expect(result).toEqual({ promoted: true, error: null });
    expect(update).toHaveBeenCalledWith({ membership_status: 'active' });
  });
});
