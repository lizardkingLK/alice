import { beforeEach, describe, expect, it, vi } from 'vitest';

const invalidateDropdownCacheMock = vi.hoisted(() => vi.fn());
const getProjectListMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/cache/dropdown-cache', () => ({
  DROPDOWN_CACHE_TAGS: {
    projects: 'dropdown-projects',
    users: 'dropdown-users',
  },
  invalidateDropdownCache: invalidateDropdownCacheMock,
}));

vi.mock('@/app/projects/_services/projects.service.server', () => ({
  getProjectList: getProjectListMock,
}));

import { loadProjectsForSprintForm } from '@/lib/cache/load-projects-for-forms';

describe('loadProjectsForSprintForm', () => {
  beforeEach(() => {
    invalidateDropdownCacheMock.mockReset();
    getProjectListMock.mockReset();
    getProjectListMock.mockResolvedValue([{ id: 'demo', name: 'Demo' }]);
  });

  it('expires the dropdown cache then returns a fresh project list', async () => {
    const projects = await loadProjectsForSprintForm();

    expect(invalidateDropdownCacheMock).toHaveBeenCalledWith(
      'dropdown-projects'
    );
    expect(getProjectListMock).toHaveBeenCalledOnce();
    expect(projects).toEqual([{ id: 'demo', name: 'Demo' }]);
  });
});
