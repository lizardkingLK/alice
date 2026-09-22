import { beforeEach, describe, expect, it, vi } from 'vitest';

const invalidateDropdownCacheMock = vi.hoisted(() => vi.fn());
const getProjectListMock = vi.hoisted(() => vi.fn());
const listAccessibleProjectIdsMock = vi.hoisted(() => vi.fn());
const getDbUserMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/cache/dropdown-cache', () => ({
  DROPDOWN_CACHE_TAGS: {
    projects: 'dropdown-projects',
    users: 'dropdown-users',
  },
  invalidateDropdownCache: invalidateDropdownCacheMock,
}));

vi.mock('@/app/projects/_services/projects.reads.server', () => ({
  getProjectList: getProjectListMock,
}));

vi.mock('@/lib/projects/project-workspace-access', () => ({
  listAccessibleProjectIds: listAccessibleProjectIdsMock,
}));

vi.mock('@/lib/auth', () => ({
  getDbUser: getDbUserMock,
}));

import { loadProjectsForSprintForm } from '@/lib/cache/load-projects-for-forms';

describe('loadProjectsForSprintForm', () => {
  beforeEach(() => {
    invalidateDropdownCacheMock.mockReset();
    getProjectListMock.mockReset();
    listAccessibleProjectIdsMock.mockReset();
    getDbUserMock.mockReset();
    getDbUserMock.mockResolvedValue({ id: 'user-1', role: 'manager' });
    getProjectListMock.mockResolvedValue([
      { id: 'demo', name: 'Demo' },
      { id: 'other', name: 'Other' },
    ]);
    listAccessibleProjectIdsMock.mockResolvedValue(['demo']);
  });

  it('expires the dropdown cache then returns membership-filtered projects', async () => {
    const projects = await loadProjectsForSprintForm();

    expect(invalidateDropdownCacheMock).toHaveBeenCalledWith(
      'dropdown-projects'
    );
    expect(getProjectListMock).toHaveBeenCalledOnce();
    expect(listAccessibleProjectIdsMock).toHaveBeenCalledWith('user-1');
    expect(projects).toEqual([{ id: 'demo', name: 'Demo' }]);
  });

  it('returns an empty list when the user is not signed in', async () => {
    getDbUserMock.mockResolvedValue(null);

    await expect(loadProjectsForSprintForm()).resolves.toEqual([]);
    expect(getProjectListMock).not.toHaveBeenCalled();
  });
});
