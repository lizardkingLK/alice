import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createWorkItemsRouter } from '../../src/routes/api/workItems/workItems.route';
import type { WorkItemService } from '../../src/routes/api/workItems/workItems.service';
import { MOCK_AUTH_USER_ID } from '../helpers/mock-api-auth';
import { withMountedRouter } from '../helpers/route-test.harness';
import { createWorkItemListRow } from '../factories/work-item.factory';

const { listWorkItemsPaginatedMock, getWorkItemDetailMock } = vi.hoisted(
  () => ({
    listWorkItemsPaginatedMock: vi.fn(),
    getWorkItemDetailMock: vi.fn(),
  })
);

vi.mock('../../src/middlewares/auth', async () => {
  const { mockRequireApiAuth } = await import('../helpers/mock-api-auth.js');
  return { requireApiAuth: mockRequireApiAuth };
});

const workItemService = {
  listWorkItemsPaginated: listWorkItemsPaginatedMock,
  getWorkItemDetail: getWorkItemDetailMock,
} as unknown as WorkItemService;

const notificationsService = {
  createAssignNotification: vi.fn(),
};

const workItemsRouter = createWorkItemsRouter({
  workItemService,
  notificationsService,
});

describe('work-items unused Prisma GET routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the paginated Prisma list envelope', async () => {
    const page = {
      workItems: [createWorkItemListRow()],
      totalCount: 1,
      page: 1,
      limit: 10,
      totalPages: 1,
    };
    listWorkItemsPaginatedMock.mockResolvedValue(page);

    await withMountedRouter(
      '/api/workItems',
      workItemsRouter,
      async (baseUrl) => {
        const response = await fetch(
          `${baseUrl}/api/workItems?projectId=${page.workItems[0]!.project_id}&view=hierarchy`
        );
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.totalCount).toBe(1);
        expect(body.workItems[0].id).toBe(page.workItems[0]!.id);
        expect(listWorkItemsPaginatedMock).toHaveBeenCalledWith(
          expect.objectContaining({
            projectId: page.workItems[0]!.project_id,
            parentId: null,
            page: 1,
            limit: 10,
          }),
          MOCK_AUTH_USER_ID
        );
      }
    );
  });

  it('rejects invalid list pagination', async () => {
    await withMountedRouter(
      '/api/workItems',
      workItemsRouter,
      async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/workItems?page=0`);
        expect(response.status).toBe(400);
        expect(listWorkItemsPaginatedMock).not.toHaveBeenCalled();
      }
    );
  });

  it('returns Prisma detail by id', async () => {
    const row = createWorkItemListRow();
    getWorkItemDetailMock.mockResolvedValue(row);

    await withMountedRouter(
      '/api/workItems',
      workItemsRouter,
      async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/workItems/${row.id}`);
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toEqual({
          data: JSON.parse(JSON.stringify(row)),
          error: null,
        });
        expect(getWorkItemDetailMock).toHaveBeenCalledWith(
          row.id,
          MOCK_AUTH_USER_ID
        );
      }
    );
  });

  it('returns 404 when Prisma detail is missing', async () => {
    getWorkItemDetailMock.mockResolvedValue(null);
    const id = '22222222-2222-4222-8222-222222222222';

    await withMountedRouter(
      '/api/workItems',
      workItemsRouter,
      async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/workItems/${id}`);
        const body = await response.json();

        expect(response.status).toBe(404);
        expect(body).toEqual({ data: null, error: 'Work item not found' });
      }
    );
  });
});
