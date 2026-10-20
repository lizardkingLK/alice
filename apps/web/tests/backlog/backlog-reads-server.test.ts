import { beforeEach, describe, expect, it, vi } from 'vitest';

const getDbUserMock = vi.hoisted(() => vi.fn());
const listAccessibleProjectIdsMock = vi.hoisted(() => vi.fn());
const getAccessibleProjectListMock = vi.hoisted(() => vi.fn());
const getUserListMock = vi.hoisted(() => vi.fn());
const getWorkItemsMock = vi.hoisted(() => vi.fn());
const getSprintsPaginatedServerMock = vi.hoisted(() => vi.fn());
const getBacklogWorkspaceBundleFromRpcMock = vi.hoisted(() => vi.fn());
const getProjectTeamMemberCapacitiesMock = vi.hoisted(() => vi.fn());
const mapDbSprintToSprintMock = vi.hoisted(() =>
  vi.fn((row: { id: string; name: string; project?: { id: string } }) => ({
    id: row.id,
    name: row.name,
    project: row.project ?? null,
  }))
);

vi.mock('@/lib/auth', () => ({
  getDbUser: getDbUserMock,
}));

vi.mock('@/lib/projects/project-workspace-access', () => ({
  listAccessibleProjectIds: listAccessibleProjectIdsMock,
}));

vi.mock('@/lib/projects/accessible-project-list', () => ({
  getAccessibleProjectList: getAccessibleProjectListMock,
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

vi.mock('@/app/sprints/_services/sprints.mutations.client', () => ({
  mapDbSprintToSprint: mapDbSprintToSprintMock,
}));

vi.mock('@/app/board/_services/board.reads.defaults.server', () => ({
  EMPTY_ACTIVE_SPRINTS_PAGE: { sprints: [] },
}));

vi.mock('@/app/backlog/_services/backlog.team-capacity.server', () => ({
  getProjectTeamMemberCapacities: getProjectTeamMemberCapacitiesMock,
}));

vi.mock('@/app/backlog/_services/backlog.reads.supabase.server', () => ({
  getBacklogWorkspaceBundleFromRpc: getBacklogWorkspaceBundleFromRpcMock,
}));

import { getBacklogWorkspace } from '@/app/backlog/_services/backlog.reads.server';

const MOCK_ACCESSIBLE_PROJECTS = [
  { id: 'proj-1', name: 'Project 1', status: 'active' },
  { id: 'proj-2', name: 'Project 2', status: 'active' },
];

const MOCK_WORK_ITEMS = [
  { id: 'wi-1', title: 'Work Item 1', project_id: 'proj-1' },
  { id: 'wi-2', title: 'Work Item 2', project_id: 'proj-2' },
];

const MOCK_SPRINTS = [
  { id: 'sprint-1', name: 'Sprint 1', project: { id: 'proj-1' } },
  { id: 'sprint-2', name: 'Sprint 2', project: { id: 'proj-2' } },
];

describe('getBacklogWorkspace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAccessibleProjectListMock.mockResolvedValue(MOCK_ACCESSIBLE_PROJECTS);
    getUserListMock.mockResolvedValue([]);
    getWorkItemsMock.mockResolvedValue(MOCK_WORK_ITEMS);
    getSprintsPaginatedServerMock.mockResolvedValue({ sprints: MOCK_SPRINTS });
    getProjectTeamMemberCapacitiesMock.mockResolvedValue([]);
    // Default: RPC missing → exercise PostgREST fallback (pre-migrate / CI).
    getBacklogWorkspaceBundleFromRpcMock.mockResolvedValue(null);
  });

  it('scopes admin the same as any role (membership-only project list)', async () => {
    getDbUserMock.mockResolvedValue({ id: 'admin-1', role: 'admin' });
    listAccessibleProjectIdsMock.mockResolvedValue(['proj-1', 'proj-2']);

    const result = await getBacklogWorkspace();

    expect(listAccessibleProjectIdsMock).toHaveBeenCalledWith('admin-1');
    expect(getAccessibleProjectListMock).toHaveBeenCalledWith('admin-1');
    expect(getBacklogWorkspaceBundleFromRpcMock).toHaveBeenCalledWith([
      'proj-1',
      'proj-2',
    ]);
    expect(getWorkItemsMock).toHaveBeenCalledWith({
      projectIds: ['proj-1', 'proj-2'],
    });
    expect(result.projects).toEqual(MOCK_ACCESSIBLE_PROJECTS);
    expect(result.initialWorkItems).toEqual(MOCK_WORK_ITEMS);
    expect(result.sprints).toEqual(MOCK_SPRINTS);
  });

  it('scopes projects, work items, and sprints for member/manager user based on accessible projects', async () => {
    getDbUserMock.mockResolvedValue({ id: 'member-1', role: 'member' });
    listAccessibleProjectIdsMock.mockResolvedValue(['proj-1']);
    getAccessibleProjectListMock.mockResolvedValue([
      { id: 'proj-1', name: 'Project 1', status: 'active' },
    ]);

    const result = await getBacklogWorkspace();

    expect(listAccessibleProjectIdsMock).toHaveBeenCalledWith('member-1');
    expect(getBacklogWorkspaceBundleFromRpcMock).toHaveBeenCalledWith([
      'proj-1',
    ]);
    expect(getWorkItemsMock).toHaveBeenCalledWith({ projectIds: ['proj-1'] });
    expect(getSprintsPaginatedServerMock).toHaveBeenCalledWith(
      'active',
      1,
      100,
      undefined,
      { projectIds: ['proj-1'] }
    );
    expect(result.projects).toEqual([
      { id: 'proj-1', name: 'Project 1', status: 'active' },
    ]);
    expect(result.sprints).toEqual(MOCK_SPRINTS);
  });

  it('returns empty lists when user has no accessible projects', async () => {
    getDbUserMock.mockResolvedValue({ id: 'member-2', role: 'member' });
    listAccessibleProjectIdsMock.mockResolvedValue([]);
    getAccessibleProjectListMock.mockResolvedValue([]);

    const result = await getBacklogWorkspace();

    expect(getBacklogWorkspaceBundleFromRpcMock).not.toHaveBeenCalled();
    expect(getWorkItemsMock).not.toHaveBeenCalled();
    expect(result.projects).toEqual([]);
    expect(result.initialWorkItems).toEqual([]);
    expect(result.sprints).toEqual([]);
  });

  it('keeps an active accessible project with no sprints or work items', async () => {
    const emptyProject = {
      id: 'proj-empty',
      name: 'Empty Project',
      status: 'active',
      deleted_at: null,
    };
    getDbUserMock.mockResolvedValue({ id: 'admin-1', role: 'admin' });
    listAccessibleProjectIdsMock.mockResolvedValue(['proj-empty']);
    getAccessibleProjectListMock.mockResolvedValue([emptyProject]);
    getWorkItemsMock.mockResolvedValue([]);
    getSprintsPaginatedServerMock.mockResolvedValue({ sprints: [] });

    const result = await getBacklogWorkspace();

    expect(result.projects).toEqual([emptyProject]);
    expect(result.initialWorkItems).toEqual([]);
    expect(result.sprints).toEqual([]);
  });

  it('uses the workspace RPC when available and skips PostgREST fallbacks', async () => {
    getDbUserMock.mockResolvedValue({ id: 'member-1', role: 'member' });
    listAccessibleProjectIdsMock.mockResolvedValue(['proj-1']);
    getAccessibleProjectListMock.mockResolvedValue([
      { id: 'proj-1', name: 'Project 1', status: 'active' },
    ]);
    getBacklogWorkspaceBundleFromRpcMock.mockResolvedValue({
      workItems: [{ id: 'wi-rpc', title: 'From RPC', project_id: 'proj-1' }],
      sprintRows: [
        {
          id: 'sprint-rpc',
          name: 'RPC Sprint',
          project: { id: 'proj-1' },
        },
      ],
      teamCapacities: [
        {
          projectId: 'proj-1',
          userId: 'user-1',
          capacity: 40,
          allocation: 100,
        },
      ],
    });

    const result = await getBacklogWorkspace();

    expect(getWorkItemsMock).not.toHaveBeenCalled();
    expect(getSprintsPaginatedServerMock).not.toHaveBeenCalled();
    expect(getProjectTeamMemberCapacitiesMock).not.toHaveBeenCalled();
    expect(result.initialWorkItems).toEqual([
      { id: 'wi-rpc', title: 'From RPC', project_id: 'proj-1' },
    ]);
    expect(result.sprints).toEqual([
      {
        id: 'sprint-rpc',
        name: 'RPC Sprint',
        project: { id: 'proj-1' },
      },
    ]);
    expect(result.teamCapacities).toEqual([
      {
        projectId: 'proj-1',
        userId: 'user-1',
        capacity: 40,
        allocation: 100,
      },
    ]);
  });
});
