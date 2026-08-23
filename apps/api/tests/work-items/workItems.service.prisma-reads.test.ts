import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ListWorkItemsQuery } from '@repo/types';
import { WorkItemService } from '../../src/routes/api/workItems/workItems.service';
import type { WorkItemRepository } from '../../src/routes/api/workItems/workItems.repository';
import { createWorkItemListRow } from '../factories/work-item.factory';

vi.mock('../../src/lib/auth-helpers', () => ({
  requireUserWithRole: vi.fn(),
}));

vi.mock('../../src/config/env', () => ({
  env: {
    STORAGE_BUCKET_ATTACHMENTS: 'attachments',
  },
}));

vi.mock('../../src/lib/file-helpers', () => ({
  removeStorageObjects: vi.fn(),
}));

const {
  listPaginatedMock,
  getDetailByIdMock,
  listAccessibleProjectIdsMock,
  requireProjectMemberMock,
} = vi.hoisted(() => ({
  listPaginatedMock: vi.fn(),
  getDetailByIdMock: vi.fn(),
  listAccessibleProjectIdsMock: vi.fn(),
  requireProjectMemberMock: vi.fn(),
}));

const repository = {
  listPaginated: listPaginatedMock,
  getDetailById: getDetailByIdMock,
  listAccessibleProjectIds: listAccessibleProjectIdsMock,
  requireProjectMember: requireProjectMemberMock,
} as unknown as WorkItemRepository;

const service = new WorkItemService(repository);

const query: ListWorkItemsQuery = {
  page: 1,
  limit: 10,
  search: 'Ship',
  projectId: '33333333-3333-4333-8333-333333333333',
  sprintId: null,
  parentId: null,
  type: 'Task',
  assigneeId: undefined,
  labels: ['api'],
  recordStatus: 'active',
  includeDescription: false,
};

describe('WorkItemService Prisma reads', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listAccessibleProjectIdsMock.mockResolvedValue('all');
    requireProjectMemberMock.mockResolvedValue({
      projectId: query.projectId,
    });
  });

  it('forwards list query filters to the Prisma repository', async () => {
    const page = {
      workItems: [createWorkItemListRow()],
      totalCount: 1,
      page: 1,
      limit: 10,
      totalPages: 1,
    };
    listPaginatedMock.mockResolvedValue(page);

    await expect(
      service.listWorkItemsPaginated(query, 'user-1')
    ).resolves.toEqual(page);
    expect(listPaginatedMock).toHaveBeenCalledWith({
      filters: {
        sprintId: null,
        projectId: query.projectId,
        parentId: null,
        type: 'Task',
        assigneeId: undefined,
        labels: ['api'],
        recordStatus: 'active',
      },
      search: 'Ship',
      page: 1,
      limit: 10,
      includeDescription: false,
    });
  });

  it('scopes list to accessible project ids for non-admins', async () => {
    listAccessibleProjectIdsMock.mockResolvedValue([
      '33333333-3333-4333-8333-333333333333',
      '44444444-4444-4444-8444-444444444444',
    ]);
    listPaginatedMock.mockResolvedValue({
      workItems: [],
      totalCount: 0,
      page: 1,
      limit: 10,
      totalPages: 1,
    });

    await service.listWorkItemsPaginated(
      { ...query, projectId: undefined },
      'user-1'
    );

    expect(listPaginatedMock).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: expect.objectContaining({
          projectIds: [
            '33333333-3333-4333-8333-333333333333',
            '44444444-4444-4444-8444-444444444444',
          ],
        }),
      })
    );
  });

  it('returns an empty page when the actor has no accessible projects', async () => {
    listAccessibleProjectIdsMock.mockResolvedValue([]);

    await expect(
      service.listWorkItemsPaginated(query, 'user-1')
    ).resolves.toEqual({
      workItems: [],
      totalCount: 0,
      page: 1,
      limit: 10,
      totalPages: 1,
    });
    expect(listPaginatedMock).not.toHaveBeenCalled();
  });

  it('loads Prisma detail by id after membership check', async () => {
    const row = createWorkItemListRow();
    getDetailByIdMock.mockResolvedValue(row);

    await expect(service.getWorkItemDetail(row.id, 'user-1')).resolves.toEqual(
      row
    );
    expect(requireProjectMemberMock).toHaveBeenCalledWith(row.id, 'user-1');
    expect(getDetailByIdMock).toHaveBeenCalledWith(row.id);
  });
});
