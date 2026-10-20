import { beforeEach, describe, expect, it, vi } from 'vitest';
import { userFactory } from '../factories/user.factory';

const { shouldReadViaApiMock, apiFetchMock, createClientMock } = vi.hoisted(
  () => ({
    shouldReadViaApiMock: vi.fn(() => false),
    apiFetchMock: vi.fn(),
    createClientMock: vi.fn(),
  })
);

vi.mock('@/lib/data-retrieval.server', () => ({
  shouldReadViaApi: shouldReadViaApiMock,
}));

vi.mock('@/lib/api/api-fetch.reads.use.server', () => ({
  apiFetch: apiFetchMock,
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: createClientMock,
}));

vi.mock('@/lib/cache/dropdown-cache', () => ({
  getCachedUserList: vi.fn(),
}));

import { getUsersListPaginated } from '@/app/users/_services/users.reads.server';

function createPaginatedSupabase(row: ReturnType<typeof userFactory.build>) {
  const range = vi.fn().mockResolvedValue({
    data: [row],
    error: null,
    count: 1,
  });
  const chain = {
    select: vi.fn(() => chain),
    or: vi.fn(() => chain),
    order: vi.fn(() => ({ range })),
  };
  return { from: vi.fn(() => chain), chain };
}

describe('user server reads retrieval toggle', () => {
  const row = userFactory.build();

  beforeEach(() => {
    vi.clearAllMocks();
    shouldReadViaApiMock.mockReturnValue(false);
  });

  it('lists via Express when the users domain is on api', async () => {
    shouldReadViaApiMock.mockReturnValue(true);
    apiFetchMock.mockResolvedValue({
      users: [{ ...row, created_at: '2026-07-09T10:00:00.000Z' }],
      totalCount: 1,
      page: 1,
      limit: 10,
      totalPages: 1,
    });

    const result = await getUsersListPaginated(1, 10, 'erlich');

    expect(shouldReadViaApiMock).toHaveBeenCalledWith('users');
    expect(apiFetchMock).toHaveBeenCalledWith(
      '/api/users?page=1&limit=10&search=erlich'
    );
    expect(createClientMock).not.toHaveBeenCalled();
    expect(result.totalCount).toBe(1);
    expect(result.users[0]?.id).toBe(row.id);
  });

  it('omits an empty search from the Express query', async () => {
    shouldReadViaApiMock.mockReturnValue(true);
    apiFetchMock.mockResolvedValue({
      users: [],
      totalCount: 0,
      page: 2,
      limit: 25,
      totalPages: 0,
    });

    await getUsersListPaginated(2, 25);

    expect(apiFetchMock).toHaveBeenCalledWith('/api/users?page=2&limit=25');
  });

  it('lists via supabase-js when the toggle is off', async () => {
    const supabase = createPaginatedSupabase(row);
    createClientMock.mockResolvedValue(supabase);

    const result = await getUsersListPaginated(1, 10, 'erlich');

    expect(createClientMock).toHaveBeenCalled();
    expect(apiFetchMock).not.toHaveBeenCalled();
    expect(supabase.chain.or).toHaveBeenCalled();
    expect(result.users).toHaveLength(1);
  });
});
