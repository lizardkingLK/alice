import { beforeEach, describe, expect, it, vi } from 'vitest';
import { accessAllowlistFactory } from '../factories/accessAllowlist.factory';

const {
  shouldReadViaApiMock,
  apiFetchMock,
  createClientMock,
  getDbUserMock,
  isAdminMock,
} = vi.hoisted(() => ({
  shouldReadViaApiMock: vi.fn(() => false),
  apiFetchMock: vi.fn(),
  createClientMock: vi.fn(),
  getDbUserMock: vi.fn(),
  isAdminMock: vi.fn(),
}));

vi.mock('@/lib/data-retrieval.server', () => ({
  shouldReadViaApi: shouldReadViaApiMock,
}));

vi.mock('@/lib/api/api-fetch.reads.use.server', () => ({
  apiFetch: apiFetchMock,
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: createClientMock,
}));

vi.mock('@/lib/auth', () => ({
  getDbUser: getDbUserMock,
}));

vi.mock('@/lib/rbac/roles', () => ({
  isAdmin: isAdminMock,
}));

import { listAccessAllowlist } from '@/app/access-allowlist/_services/access-allowlist.reads.server';

function createListSupabase(
  row: ReturnType<typeof accessAllowlistFactory.build>
) {
  const range = vi.fn().mockResolvedValue({
    data: [row],
    error: null,
    count: 1,
  });
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    or: vi.fn(() => chain),
    order: vi.fn(() => ({ range })),
  };
  return { from: vi.fn(() => chain), chain };
}

describe('access allowlist server reads retrieval toggle', () => {
  const row = accessAllowlistFactory.build();

  beforeEach(() => {
    vi.clearAllMocks();
    shouldReadViaApiMock.mockReturnValue(false);
    getDbUserMock.mockResolvedValue({ id: 'admin-1', role: 'admin' });
    isAdminMock.mockReturnValue(true);
  });

  it('lists via Express when the access-allowlist domain is on api', async () => {
    // Arrange
    shouldReadViaApiMock.mockReturnValue(true);
    apiFetchMock.mockResolvedValue({
      items: [{ ...row }],
      totalCount: 1,
      page: 1,
      limit: 10,
      totalPages: 1,
    });

    // Act
    const result = await listAccessAllowlist({ search: 'acme' });

    // Assert
    expect(shouldReadViaApiMock).toHaveBeenCalledWith('access-allowlist');
    expect(apiFetchMock).toHaveBeenCalledWith(
      '/api/access-allowlist?page=1&limit=10&status=active&search=acme'
    );
    expect(createClientMock).not.toHaveBeenCalled();
    expect(getDbUserMock).not.toHaveBeenCalled();
    expect(result.items[0]?.id).toBe(row.id);
  });

  it('forwards status, page and limit to Express', async () => {
    // Arrange
    shouldReadViaApiMock.mockReturnValue(true);
    apiFetchMock.mockResolvedValue({
      items: [],
      totalCount: 0,
      page: 2,
      limit: 25,
      totalPages: 0,
    });

    // Act
    await listAccessAllowlist({ status: 'all', page: 2, limit: 25 });

    // Assert
    expect(apiFetchMock).toHaveBeenCalledWith(
      '/api/access-allowlist?page=2&limit=25&status=all'
    );
  });

  it('maps Date timestamps from the Express payload to ISO strings', async () => {
    // Arrange
    shouldReadViaApiMock.mockReturnValue(true);
    const stamp = new Date('2026-07-09T10:00:00.000Z');
    apiFetchMock.mockResolvedValue({
      items: [
        { ...row, created_at: stamp, updated_at: stamp, expires_at: stamp },
      ],
      totalCount: 1,
      page: 1,
      limit: 10,
      totalPages: 1,
    });

    // Act
    const result = await listAccessAllowlist();

    // Assert
    expect(result.items[0]).toMatchObject({
      created_at: '2026-07-09T10:00:00.000Z',
      updated_at: '2026-07-09T10:00:00.000Z',
      expires_at: '2026-07-09T10:00:00.000Z',
    });
  });

  it('propagates the Express 403 for non-admins', async () => {
    // Arrange
    shouldReadViaApiMock.mockReturnValue(true);
    apiFetchMock.mockRejectedValue(new Error('Forbidden'));

    // Act
    const result = listAccessAllowlist();

    // Assert
    await expect(result).rejects.toThrow('Forbidden');
  });

  it('lists via supabase-js when the toggle is off', async () => {
    // Arrange
    const supabase = createListSupabase(row);
    createClientMock.mockResolvedValue(supabase);

    // Act
    const result = await listAccessAllowlist({ search: 'acme' });

    // Assert
    expect(shouldReadViaApiMock).toHaveBeenCalledWith('access-allowlist');
    expect(apiFetchMock).not.toHaveBeenCalled();
    expect(supabase.chain.or).toHaveBeenCalled();
    expect(result.items).toHaveLength(1);
  });

  it('returns an empty page for non-admins when the toggle is off', async () => {
    // Arrange
    isAdminMock.mockReturnValue(false);

    // Act
    const result = await listAccessAllowlist({ page: 1, limit: 10 });

    // Assert
    expect(createClientMock).not.toHaveBeenCalled();
    expect(apiFetchMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({ items: [], totalCount: 0 });
  });
});
