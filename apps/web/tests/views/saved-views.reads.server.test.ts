import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SavedView } from '@/app/views/_services/saved-views.reads.types';

const { shouldReadViaApiMock, apiFetchMock, createClientMock, getUserMock } =
  vi.hoisted(() => ({
    shouldReadViaApiMock: vi.fn(() => false),
    apiFetchMock: vi.fn(),
    createClientMock: vi.fn(),
    getUserMock: vi.fn(),
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
  getUser: getUserMock,
}));

import { getSavedViewsPaginated } from '@/app/views/_services/saved-views.reads.server';

function buildSavedView(overrides: Partial<SavedView> = {}): SavedView {
  return {
    id: 'view-1',
    owner_id: 'user-123',
    title: 'My sprint board',
    description: null,
    pathname: '/board',
    search: '',
    project_id: null,
    resource_kind: null,
    resource_id: null,
    status: 'active',
    created_by: 'user-123',
    created_at: '2026-07-09T10:00:00.000Z',
    updated_by: null,
    updated_at: '2026-07-09T10:00:00.000Z',
    ...overrides,
  } as SavedView;
}

function createOwnedSupabase(row: SavedView) {
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

describe('saved views server reads retrieval toggle', () => {
  const row = buildSavedView();

  beforeEach(() => {
    vi.clearAllMocks();
    shouldReadViaApiMock.mockReturnValue(false);
    getUserMock.mockResolvedValue({ id: 'user-123' });
  });

  it('lists via Express when the saved-views domain is on api', async () => {
    // Arrange
    shouldReadViaApiMock.mockReturnValue(true);
    apiFetchMock.mockResolvedValue({
      views: [{ ...row }],
      totalCount: 1,
      page: 1,
      limit: 10,
      totalPages: 1,
    });

    // Act
    const result = await getSavedViewsPaginated(1, 10, 'shared', 'sprint');

    // Assert
    expect(shouldReadViaApiMock).toHaveBeenCalledWith('saved-views');
    expect(apiFetchMock).toHaveBeenCalledWith(
      '/api/saved-views?page=1&limit=10&tab=shared&search=sprint'
    );
    expect(createClientMock).not.toHaveBeenCalled();
    expect(result.totalCount).toBe(1);
    expect(result.views[0]?.id).toBe(row.id);
  });

  it('omits an empty search from the Express query', async () => {
    // Arrange
    shouldReadViaApiMock.mockReturnValue(true);
    apiFetchMock.mockResolvedValue({
      views: [],
      totalCount: 0,
      page: 2,
      limit: 25,
      totalPages: 0,
    });

    // Act
    await getSavedViewsPaginated(2, 25, 'mine');

    // Assert
    expect(apiFetchMock).toHaveBeenCalledWith(
      '/api/saved-views?page=2&limit=25&tab=mine'
    );
  });

  it('maps Date timestamps from the Express payload to ISO strings', async () => {
    // Arrange
    shouldReadViaApiMock.mockReturnValue(true);
    const createdAt = new Date('2026-07-09T10:00:00.000Z');
    apiFetchMock.mockResolvedValue({
      views: [{ ...row, created_at: createdAt, updated_at: createdAt }],
      totalCount: 1,
      page: 1,
      limit: 10,
      totalPages: 1,
    });

    // Act
    const result = await getSavedViewsPaginated(1, 10, 'archived');

    // Assert
    expect(result.views[0]?.created_at).toBe('2026-07-09T10:00:00.000Z');
    expect(result.views[0]?.updated_at).toBe('2026-07-09T10:00:00.000Z');
  });

  it('lists via supabase-js when the toggle is off', async () => {
    // Arrange
    const supabase = createOwnedSupabase(row);
    createClientMock.mockResolvedValue(supabase);

    // Act
    const result = await getSavedViewsPaginated(1, 10, 'mine', 'sprint');

    // Assert
    expect(shouldReadViaApiMock).toHaveBeenCalledWith('saved-views');
    expect(apiFetchMock).not.toHaveBeenCalled();
    expect(supabase.from).toHaveBeenCalledWith('saved_views');
    expect(supabase.chain.or).toHaveBeenCalled();
    expect(result.views).toHaveLength(1);
  });
});
