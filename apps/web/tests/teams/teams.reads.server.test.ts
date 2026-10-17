import { beforeEach, describe, expect, it, vi } from 'vitest';

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
  getActiveProjectTeams,
  getTeamListPaginated,
} from '@/app/manager/_services/teams.reads.server';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';

const teamRow = {
  id: 'team-1',
  name: 'Platform',
  description: null,
  manager_id: 'user-1',
  project_id: PROJECT_ID,
  tech_stack: null,
  status: 'active',
  created_at: '2026-07-09T10:00:00.000Z',
  updated_at: '2026-07-09T10:00:00.000Z',
  manager: { id: 'user-1', name: 'Ada', email: 'ada@example.com' },
  members: [],
};

function createPaginatedSupabase() {
  const range = vi.fn().mockResolvedValue({
    data: [teamRow],
    error: null,
    count: 1,
  });
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    or: vi.fn(() => chain),
    order: vi.fn(() => ({ range })),
  };
  return { from: vi.fn(() => chain) };
}

function createActiveTeamsSupabase() {
  const result = { data: [teamRow], error: null };
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    order: vi.fn().mockResolvedValue(result),
  };
  return { from: vi.fn(() => chain) };
}

describe('team server reads retrieval toggle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    shouldReadViaApiMock.mockReturnValue(false);
  });

  it('lists via Express when the teams domain is on api', async () => {
    shouldReadViaApiMock.mockReturnValue(true);
    apiFetchMock.mockResolvedValue({
      teams: [teamRow],
      totalCount: 1,
      page: 2,
      limit: 10,
      totalPages: 1,
    });

    const result = await getTeamListPaginated(
      2,
      10,
      'active',
      ' Plat ',
      PROJECT_ID
    );

    expect(shouldReadViaApiMock).toHaveBeenCalledWith('teams');
    expect(apiFetchMock).toHaveBeenCalledWith(
      `/api/teams?page=2&limit=10&status=active&search=Plat&projectId=${PROJECT_ID}`
    );
    expect(createClientMock).not.toHaveBeenCalled();
    expect(result.teams).toHaveLength(1);
    expect(result.totalCount).toBe(1);
  });

  it('omits optional params from the Express query when unset', async () => {
    shouldReadViaApiMock.mockReturnValue(true);
    apiFetchMock.mockResolvedValue({
      teams: [],
      totalCount: 0,
      page: 1,
      limit: 5,
      totalPages: 1,
    });

    await getTeamListPaginated(1, 5);

    expect(apiFetchMock).toHaveBeenCalledWith('/api/teams?page=1&limit=5');
  });

  it('lists via supabase-js when the toggle is off', async () => {
    createClientMock.mockResolvedValue(createPaginatedSupabase());

    const result = await getTeamListPaginated(1, 10);

    expect(createClientMock).toHaveBeenCalled();
    expect(apiFetchMock).not.toHaveBeenCalled();
    expect(result.teams).toHaveLength(1);
  });

  it('keeps active project teams on supabase-js even when the toggle is on', async () => {
    shouldReadViaApiMock.mockReturnValue(true);
    createClientMock.mockResolvedValue(createActiveTeamsSupabase());

    const result = await getActiveProjectTeams(PROJECT_ID);

    expect(createClientMock).toHaveBeenCalled();
    expect(apiFetchMock).not.toHaveBeenCalled();
    expect(result).toHaveLength(1);
  });
});
