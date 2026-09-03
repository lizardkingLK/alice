import { beforeEach, describe, expect, it, vi } from 'vitest';

const getDbUserMock = vi.hoisted(() => vi.fn());
const listAccessibleProjectIdsMock = vi.hoisted(() => vi.fn());
const getProjectListMock = vi.hoisted(() => vi.fn());
const getUserListMock = vi.hoisted(() => vi.fn());
const getWorkItemsMock = vi.hoisted(() => vi.fn());
const getSprintsPaginatedServerMock = vi.hoisted(() => vi.fn());
const getSuggestedBoardDefaultsMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/auth', () => ({
  getDbUser: getDbUserMock,
}));

vi.mock('@/lib/projects/project-workspace-access', () => ({
  listAccessibleProjectIds: listAccessibleProjectIdsMock,
}));

vi.mock('@/app/projects/_services/projects.reads.server', () => ({
  getProjectList: getProjectListMock,
}));

vi.mock('@/app/users/_services/users.reads.server', () => ({
  getUserList: getUserListMock,
}));

vi.mock('@/app/work-items/_services/work-items.reads.server', () => ({
  getWorkItems: getWorkItemsMock,
}));

vi.mock('@/app/sprints/_services/sprints.reads.server', () => ({
  getSprintsPaginatedServer: getSprintsPaginatedServerMock,
}));

vi.mock('@/app/board/_services/board.reads.defaults.server', () => ({
  EMPTY_ACTIVE_SPRINTS_PAGE: { sprints: [] },
  getSuggestedBoardDefaults: getSuggestedBoardDefaultsMock,
}));

vi.mock('@/app/board/_components/board-workspace', () => ({
  BoardWorkspace: (props: unknown) => props,
}));

import { BoardData } from '@/app/board/_components/board-data';

const MOCK_PROJECTS = [
  { id: 'proj-1', name: 'Project 1', status: 'active' },
  { id: 'proj-2', name: 'Project 2', status: 'active' },
  { id: 'proj-3', name: 'Project 3', status: 'archived' },
];

const MOCK_WORK_ITEMS = [
  { id: 'wi-1', title: 'Work Item 1', project_id: 'proj-1', status: 'In Progress' },
  { id: 'wi-2', title: 'Work Item 2', project_id: 'proj-2', status: 'Todo' },
];

const MOCK_SPRINTS = [
  { id: 'sprint-1', name: 'Sprint 1', project: { id: 'proj-1' } },
  { id: 'sprint-2', name: 'Sprint 2', project: { id: 'proj-2' } },
];

describe('BoardData project scoping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getProjectListMock.mockResolvedValue(MOCK_PROJECTS);
    getUserListMock.mockResolvedValue([]);
    getWorkItemsMock.mockResolvedValue(MOCK_WORK_ITEMS);
    getSprintsPaginatedServerMock.mockResolvedValue({ sprints: MOCK_SPRINTS });
    getSuggestedBoardDefaultsMock.mockResolvedValue(null);
  });

  it('provides all active projects for admin user', async () => {
    getDbUserMock.mockResolvedValue({ id: 'admin-1', role: 'admin' });
    listAccessibleProjectIdsMock.mockResolvedValue('all');

    const jsx = await BoardData({ searchParams: Promise.resolve({}) });
    const props = jsx.props as {
      projects: typeof MOCK_PROJECTS;
      sprints: typeof MOCK_SPRINTS;
      allowAllFilters: boolean;
    };

    expect(listAccessibleProjectIdsMock).toHaveBeenCalledWith('admin-1', 'admin');
    expect(getWorkItemsMock).toHaveBeenCalledWith(
      { projectId: undefined, sprintId: undefined },
      { includeDescription: true }
    );
    expect(props.projects).toEqual([
      { id: 'proj-1', name: 'Project 1', status: 'active' },
      { id: 'proj-2', name: 'Project 2', status: 'active' },
    ]);
    expect(props.sprints).toEqual(MOCK_SPRINTS);
    expect(props.allowAllFilters).toBe(true);
  });

  it('scopes projects, sprints, and work items to accessible projects for member user', async () => {
    getDbUserMock.mockResolvedValue({ id: 'member-1', role: 'member' });
    listAccessibleProjectIdsMock.mockResolvedValue(['proj-1']);

    const jsx = await BoardData({ searchParams: Promise.resolve({}) });
    const props = jsx.props as {
      projects: typeof MOCK_PROJECTS;
      sprints: typeof MOCK_SPRINTS;
      allowAllFilters: boolean;
    };

    expect(listAccessibleProjectIdsMock).toHaveBeenCalledWith('member-1', 'member');
    expect(getWorkItemsMock).toHaveBeenCalledWith(
      { projectId: undefined, sprintId: undefined, projectIds: ['proj-1'] },
      { includeDescription: true }
    );
    expect(props.projects).toEqual([
      { id: 'proj-1', name: 'Project 1', status: 'active' },
    ]);
    expect(props.sprints).toEqual([
      { id: 'sprint-1', name: 'Sprint 1', project: { id: 'proj-1' } },
    ]);
    expect(props.allowAllFilters).toBe(false);
  });

  it('returns empty lists when user has no accessible projects', async () => {
    getDbUserMock.mockResolvedValue({ id: 'member-2', role: 'member' });
    listAccessibleProjectIdsMock.mockResolvedValue([]);

    const jsx = await BoardData({ searchParams: Promise.resolve({}) });
    const props = jsx.props as {
      projects: typeof MOCK_PROJECTS;
      sprints: typeof MOCK_SPRINTS;
    };

    expect(getWorkItemsMock).not.toHaveBeenCalled();
    expect(props.projects).toEqual([]);
    expect(props.sprints).toEqual([]);
  });
});
