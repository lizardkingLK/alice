import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ListWorkItemsQuery } from '@repo/types';
import { WorkItemService } from '../../src/routes/api/workItems/workItems.service';
import type { WorkItemRepository } from '../../src/routes/api/workItems/workItems.repository';
import { createWorkItemListRow } from '../factories/work-item.factory';

const { listPaginatedMock, getDetailByIdMock } = vi.hoisted(() => ({
  listPaginatedMock: vi.fn(),
  getDetailByIdMock: vi.fn(),
}));

const repository = {
  listPaginated: listPaginatedMock,
  getDetailById: getDetailByIdMock,
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
  includeDescription: false,
};

describe('WorkItemService Prisma reads', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

    await expect(service.listWorkItemsPaginated(query)).resolves.toEqual(page);
    expect(listPaginatedMock).toHaveBeenCalledWith({
      filters: {
        sprintId: null,
        projectId: query.projectId,
        parentId: null,
        type: 'Task',
        assigneeId: undefined,
        labels: ['api'],
      },
      search: 'Ship',
      page: 1,
      limit: 10,
      includeDescription: false,
    });
  });

  it('loads Prisma detail by id', async () => {
    const row = createWorkItemListRow();
    getDetailByIdMock.mockResolvedValue(row);

    await expect(service.getWorkItemDetail(row.id)).resolves.toEqual(row);
    expect(getDetailByIdMock).toHaveBeenCalledWith(row.id);
  });
});
