import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/api-fetch.helper';

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

import {
  getSprint,
  getSprintsPaginatedServer,
} from '@/app/sprints/_services/sprints.reads.server';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';

/** Shape Express returns: Prisma `Date` fields serialized to ISO strings. */
const apiRow = {
  id: 'sprint-123',
  project_id: PROJECT_ID,
  name: 'Sprint 1',
  goal: 'Ship it',
  start_date: '2026-07-10T00:00:00.000Z',
  end_date: '2026-07-24T00:00:00.000Z',
  status: 'planned',
  summary_report: null,
  created_by: 'user-1',
  created_at: '2026-07-09T10:00:00.000Z',
  updated_by: null,
  updated_at: '2026-07-09T10:00:00.000Z',
  project: { id: PROJECT_ID, key: 'PAL', name: 'Project Alpha' },
};

function createPaginatedSupabase() {
  const range = vi.fn().mockResolvedValue({
    data: [{ ...apiRow, start_date: '2026-07-10', end_date: '2026-07-24' }],
    error: null,
    count: 1,
  });
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    in: vi.fn(() => chain),
    or: vi.fn(() => chain),
    order: vi.fn(() => ({ range })),
  };
  return { from: vi.fn(() => chain) };
}

function createDetailSupabase() {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    maybeSingle: vi.fn().mockResolvedValue({
      data: { ...apiRow, start_date: '2026-07-10', end_date: '2026-07-24' },
      error: null,
    }),
  };
  return { from: vi.fn(() => chain) };
}

describe('sprint server reads retrieval toggle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    shouldReadViaApiMock.mockReturnValue(false);
  });

  it('lists via Express and maps dates when the sprints domain is on api', async () => {
    shouldReadViaApiMock.mockReturnValue(true);
    apiFetchMock.mockResolvedValue({
      sprints: [apiRow],
      totalCount: 1,
      page: 1,
      limit: 5,
      totalPages: 1,
    });

    const result = await getSprintsPaginatedServer(
      'archived',
      1,
      5,
      ' Sprint ',
      { projectId: PROJECT_ID }
    );

    expect(shouldReadViaApiMock).toHaveBeenCalledWith('sprints');
    expect(apiFetchMock).toHaveBeenCalledWith(
      `/api/sprints?page=1&limit=5&tab=archived&search=Sprint&projectId=${PROJECT_ID}`
    );
    expect(createClientMock).not.toHaveBeenCalled();
    expect(result.pagination).toEqual({
      page: 1,
      limit: 5,
      totalCount: 1,
      totalPages: 1,
    });
    expect(result.sprints[0]).toMatchObject({
      id: 'sprint-123',
      startDate: '2026-07-10',
      endDate: '2026-07-24',
      createdAt: '2026-07-09T10:00:00.000Z',
      project: { id: PROJECT_ID, key: 'PAL', name: 'Project Alpha' },
    });
  });

  it('short-circuits empty accessible scope without hitting api or supabase', async () => {
    shouldReadViaApiMock.mockReturnValue(true);

    const result = await getSprintsPaginatedServer('active', 1, 5, undefined, {
      projectIds: [],
    });

    expect(result.sprints).toEqual([]);
    expect(apiFetchMock).not.toHaveBeenCalled();
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it('lists via supabase-js when the toggle is off', async () => {
    createClientMock.mockResolvedValue(createPaginatedSupabase());

    const result = await getSprintsPaginatedServer('active', 1, 5);

    expect(createClientMock).toHaveBeenCalled();
    expect(apiFetchMock).not.toHaveBeenCalled();
    expect(result.sprints).toHaveLength(1);
  });

  it('loads detail via Express when the sprints domain is on api', async () => {
    shouldReadViaApiMock.mockReturnValue(true);
    apiFetchMock.mockResolvedValue({ data: apiRow, error: null });

    const result = await getSprint('api-sprint-1');

    expect(shouldReadViaApiMock).toHaveBeenCalledWith('sprints');
    expect(apiFetchMock).toHaveBeenCalledWith('/api/sprints/api-sprint-1');
    expect(createClientMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      id: 'sprint-123',
      startDate: '2026-07-10',
      endDate: '2026-07-24',
    });
  });

  it('returns null for a missing sprint over Express', async () => {
    shouldReadViaApiMock.mockReturnValue(true);
    apiFetchMock.mockRejectedValue(new ApiError('Sprint not found', 404));

    await expect(getSprint('api-missing-sprint')).resolves.toBeNull();
  });

  it('rethrows non-404 Express errors', async () => {
    shouldReadViaApiMock.mockReturnValue(true);
    apiFetchMock.mockRejectedValue(new ApiError('boom', 500));

    await expect(getSprint('api-error-sprint')).rejects.toThrow('boom');
  });

  it('loads detail via supabase-js when the toggle is off', async () => {
    createClientMock.mockResolvedValue(createDetailSupabase());

    const result = await getSprint('ssr-sprint-1');

    expect(createClientMock).toHaveBeenCalled();
    expect(apiFetchMock).not.toHaveBeenCalled();
    expect(result?.id).toBe('sprint-123');
  });
});
