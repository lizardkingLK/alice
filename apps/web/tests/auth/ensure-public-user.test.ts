import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '@supabase/supabase-js';
import { ensurePublicUser } from '@/lib/ensure-public-user';
import { createAdminClient } from '../mocks/supabase-admin';

vi.mock('@/lib/supabase/admin', () => import('../mocks/supabase-admin'));

type UsersLookup = {
  id?: { id: string } | null;
  email?: { id: string } | null;
};

type UsersAdminOptions = {
  existing?: UsersLookup;
  insertError?: { code?: string; message: string } | null;
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
    from: vi.fn(() => ({
      select: vi.fn(() => filterChain),
      insert,
    })),
  };
}

function mockUsersAdmin(options: UsersAdminOptions) {
  const { insert, from } = createUsersAdminClient(options);
  createAdminClient.mockImplementation(() => ({ from }));
  return { insert };
}

function authUser(overrides: Partial<User> = {}): User {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'alex@acme.com',
    app_metadata: {},
    user_metadata: { name: 'Alex' },
    aud: 'authenticated',
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  } as User;
}

describe('ensurePublicUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not insert when a profile already exists for the Auth id', async () => {
    const { insert } = mockUsersAdmin({
      existing: { id: { id: '11111111-1111-4111-8111-111111111111' } },
    });

    const result = await ensurePublicUser(authUser());

    expect(result).toEqual({ created: false, error: null });
    expect(insert).not.toHaveBeenCalled();
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
    });

    const result = await ensurePublicUser(authUser());

    expect(result).toEqual({ created: false, error: null });
  });

  it('inserts a new profile when id and email are free', async () => {
    const { insert } = mockUsersAdmin({
      existing: { id: null, email: null },
    });

    const result = await ensurePublicUser(authUser());

    expect(result).toEqual({ created: true, error: null });
    expect(insert).toHaveBeenCalled();
  });
});
