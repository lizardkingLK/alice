import { beforeEach, describe, expect, it, vi } from 'vitest';
import { projectFactory } from '../factories/project.factory';

const {
  shouldReadViaApiMock,
  apiFetchMock,
  createClientMock,
  getDbUserMock,
  listAccessibleProjectIdsMock,
} = vi.hoisted(() => ({
  shouldReadViaApiMock: vi.fn(() => false),
  apiFetchMock: vi.fn(),
  createClientMock: vi.fn(),
  getDbUserMock: vi.fn(),
  listAccessibleProjectIdsMock: vi.fn(),
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

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getDbUser: getDbUserMock,
  getUser: vi.fn(),
}));

vi.mock('@/lib/projects/project-workspace-access', () => ({
  listAccessibleProjectIds: listAccessibleProjectIdsMock,
}));

vi.mock('@/lib/cache/dropdown-cache', () => ({
  getCachedProjectList: vi.fn(),
}));

import {
  getProject,
  getProjectDetails,
  getProjectListPaginated,
  getProjectMembers,
} from '@/app/projects/_services/projects.reads.server';

function createListSupabase(row: ReturnType<typeof projectFactory.build>) {
  const range = vi.fn().mockResolvedValue({
    data: [row],
    error: null,
    count: 1,
  });
  const projectsChain = {
    select: vi.fn(() => projectsChain),
    in: vi.fn(() => projectsChain),
    is: vi.fn(() => projectsChain),
    not: vi.fn(() => projectsChain),
    or: vi.fn(() => projectsChain),
    order: vi.fn(() => ({ range })),
  };
  const teamsChain = {
    select: vi.fn(() => teamsChain),
    in: vi.fn(() => teamsChain),
    neq: vi.fn().mockResolvedValue({
      data: [{ project_id: row.id }, { project_id: row.id }],
      error: null,
    }),
  };
  return {
    from: vi.fn((table: string) =>
      table === 'teams' ? teamsChain : projectsChain
    ),
  };
}

function createDetailSupabase(row: ReturnType<typeof projectFactory.build>) {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    maybeSingle: vi.fn().mockResolvedValue({ data: row, error: null }),
  };
  return { from: vi.fn(() => chain) };
}

function createMembersSupabase(members: unknown[]) {
  const secondEq = vi.fn().mockResolvedValue({ data: members, error: null });
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => ({ eq: secondEq })),
  };
  return { from: vi.fn(() => chain) };
}

describe('project server reads retrieval toggle', () => {
  const row = projectFactory.build();

  beforeEach(() => {
    vi.clearAllMocks();
    shouldReadViaApiMock.mockReturnValue(false);
    getDbUserMock.mockResolvedValue({ id: 'user-1' });
    listAccessibleProjectIdsMock.mockResolvedValue([row.id]);
  });

  describe('getProjectListPaginated', () => {
    it('lists via Express when the projects domain is on api', async () => {
      shouldReadViaApiMock.mockReturnValue(true);
      apiFetchMock.mockResolvedValue({
        projects: [
          {
            ...row,
            start_date: '2026-08-01T00:00:00.000Z',
            end_date: null,
            team_count: 2,
          },
        ],
        totalCount: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      });

      const result = await getProjectListPaginated(1, 10, 'archived', 'Alpha');

      expect(shouldReadViaApiMock).toHaveBeenCalledWith('projects');
      expect(apiFetchMock).toHaveBeenCalledWith(
        '/api/projects?page=1&limit=10&status=archived&search=Alpha'
      );
      expect(createClientMock).not.toHaveBeenCalled();
      expect(result.totalCount).toBe(1);
      expect(result.projects[0]?.start_date).toBe('2026-08-01');
      expect(result.projects[0]?.team_count).toBe(2);
    });

    it('defaults status to active on the Express query', async () => {
      shouldReadViaApiMock.mockReturnValue(true);
      apiFetchMock.mockResolvedValue({
        projects: [],
        totalCount: 0,
        page: 1,
        limit: 10,
        totalPages: 0,
      });

      await getProjectListPaginated(1, 10);

      expect(apiFetchMock).toHaveBeenCalledWith(
        '/api/projects?page=1&limit=10&status=active'
      );
    });

    it('lists via supabase-js when the toggle is off', async () => {
      createClientMock.mockResolvedValue(createListSupabase(row));

      const result = await getProjectListPaginated(1, 10);

      expect(createClientMock).toHaveBeenCalled();
      expect(apiFetchMock).not.toHaveBeenCalled();
      expect(result.projects).toHaveLength(1);
      expect(result.projects[0]?.team_count).toBe(2);
    });
  });

  describe.each([
    ['getProject', getProject],
    ['getProjectDetails', getProjectDetails],
  ])('%s', (_name, read) => {
    it('loads detail via Express when the projects domain is on api', async () => {
      shouldReadViaApiMock.mockReturnValue(true);
      apiFetchMock.mockResolvedValue({
        data: { ...row, start_date: '2026-08-01T00:00:00.000Z' },
        error: null,
      });

      const result = await read(row.id);

      expect(shouldReadViaApiMock).toHaveBeenCalledWith('projects');
      expect(apiFetchMock).toHaveBeenCalledWith(`/api/projects/${row.id}`);
      expect(createClientMock).not.toHaveBeenCalled();
      expect(result.id).toBe(row.id);
      expect(result.start_date).toBe('2026-08-01');
    });

    it('loads detail via supabase-js when the toggle is off', async () => {
      createClientMock.mockResolvedValue(createDetailSupabase(row));

      const result = await read(row.id);

      expect(createClientMock).toHaveBeenCalled();
      expect(apiFetchMock).not.toHaveBeenCalled();
      expect(result.id).toBe(row.id);
    });
  });

  describe('getProjectMembers', () => {
    const member = {
      project_id: row.id,
      user_id: 'user-1',
      status: 'active',
      created_at: '2026-07-09T10:00:00.000Z',
      user: {
        id: 'user-1',
        name: 'Ada',
        email: 'ada@example.com',
        role: 'member',
      },
    };

    it('loads members via Express when the projects domain is on api', async () => {
      shouldReadViaApiMock.mockReturnValue(true);
      apiFetchMock.mockResolvedValue({
        members: [member, { ...member, user_id: 'user-2', user: null }],
      });

      const result = await getProjectMembers(row.id);

      expect(shouldReadViaApiMock).toHaveBeenCalledWith('projects');
      expect(apiFetchMock).toHaveBeenCalledWith(
        `/api/projects/${row.id}/members`
      );
      expect(createClientMock).not.toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect(result[0]?.user_id).toBe('user-1');
    });

    it('loads members via supabase-js when the toggle is off', async () => {
      createClientMock.mockResolvedValue(createMembersSupabase([member]));

      const result = await getProjectMembers(row.id);

      expect(createClientMock).toHaveBeenCalled();
      expect(apiFetchMock).not.toHaveBeenCalled();
      expect(result).toHaveLength(1);
    });
  });
});
