import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createWorkItemsRouter } from '../../src/routes/api/workItems/workItems.route';
import type { WorkItemService } from '../../src/routes/api/workItems/workItems.service';
import { MOCK_AUTH_USER_ID } from '../helpers/mock-api-auth';
import { withMountedRouter } from '../helpers/route-test.harness';
import { createWorkItemListRow } from '../factories/work-item.factory';
import {
  BoardMoveForbiddenError,
  StatusTransitionForbiddenError,
} from '../../src/routes/api/workItems/workItems.errors';
import {
  BOARD_MOVE_FORBIDDEN_CODE,
  STATUS_TRANSITION_FORBIDDEN_CODE,
} from '@repo/types';

const {
  listWorkItemsPaginatedMock,
  getWorkItemDetailMock,
  getWorkItemMock,
  updateWorkItemMock,
} = vi.hoisted(() => ({
  listWorkItemsPaginatedMock: vi.fn(),
  getWorkItemDetailMock: vi.fn(),
  getWorkItemMock: vi.fn(),
  updateWorkItemMock: vi.fn(),
}));

vi.mock('../../src/middlewares/auth', async () => {
  const { mockRequireApiAuth } = await import('../helpers/mock-api-auth.js');
  return { requireApiAuth: mockRequireApiAuth };
});

const workItemService = {
  listWorkItemsPaginated: listWorkItemsPaginatedMock,
  getWorkItemDetail: getWorkItemDetailMock,
  getWorkItem: getWorkItemMock,
  updateWorkItem: updateWorkItemMock,
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

  it('returns the stable 403 code for a forbidden board movement', async () => {
    const row = {
      ...createWorkItemListRow(),
      description: null,
      updated_at: '2026-08-01T00:00:00.000Z',
      created_at: '2026-08-01T00:00:00.000Z',
    };
    getWorkItemMock.mockResolvedValue(row);
    updateWorkItemMock.mockRejectedValue(new BoardMoveForbiddenError());

    await withMountedRouter(
      '/api/workItems',
      workItemsRouter,
      async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/workItems/${row.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'InProgress',
            board_column_id: null,
            expectedUpdatedAt: row.updated_at,
          }),
        });
        const body = await response.json();

        expect(response.status).toBe(403);
        expect(body).toEqual({
          data: null,
          error: 'You do not have permission to perform this board movement.',
          code: BOARD_MOVE_FORBIDDEN_CODE,
        });
      }
    );
  });

  it('returns the stable 403 code for a forbidden status transition', async () => {
    const row = {
      ...createWorkItemListRow(),
      description: null,
      updated_at: '2026-08-01T00:00:00.000Z',
      created_at: '2026-08-01T00:00:00.000Z',
    };
    getWorkItemMock.mockResolvedValue(row);
    updateWorkItemMock.mockRejectedValue(new StatusTransitionForbiddenError());

    await withMountedRouter(
      '/api/workItems',
      workItemsRouter,
      async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/workItems/${row.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'InProgress',
            board_column_id: null,
            expectedUpdatedAt: row.updated_at,
          }),
        });
        const body = await response.json();

        expect(response.status).toBe(403);
        expect(body).toEqual({
          data: null,
          error:
            'You do not have permission to perform this status transition.',
          code: STATUS_TRANSITION_FORBIDDEN_CODE,
        });
      }
    );
  });
});
