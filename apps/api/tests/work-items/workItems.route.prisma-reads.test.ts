import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { createWorkItemsRouter } from '../../src/routes/api/workItems/workItems.route';
import type { WorkItemService } from '../../src/routes/api/workItems/workItems.service';
import { createWorkItemListRow } from '../factories/work-item.factory';

const { listWorkItemsPaginatedMock, getWorkItemDetailMock } = vi.hoisted(
  () => ({
    listWorkItemsPaginatedMock: vi.fn(),
    getWorkItemDetailMock: vi.fn(),
  })
);

vi.mock('../../src/middlewares/auth', () => ({
  requireApiAuth: (
    req: { userId?: string },
    _res: unknown,
    next: () => void
  ) => {
    req.userId = 'user-1';
    next();
  },
}));

const workItemService = {
  listWorkItemsPaginated: listWorkItemsPaginatedMock,
  getWorkItemDetail: getWorkItemDetailMock,
} as unknown as WorkItemService;

const notificationsService = {
  createAssignNotification: vi.fn(),
};

async function withApp(run: (baseUrl: string) => Promise<void>): Promise<void> {
  const app = express();
  app.disable('x-powered-by');
  app.use(
    '/api/workItems',
    createWorkItemsRouter({ workItemService, notificationsService })
  );

  const server: Server = await new Promise((resolve) => {
    const next = app.listen(0, '127.0.0.1', () => resolve(next));
  });

  try {
    const address = server.address() as AddressInfo;
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

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

    await withApp(async (baseUrl) => {
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
        })
      );
    });
  });

  it('rejects invalid list pagination', async () => {
    await withApp(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/workItems?page=0`);
      expect(response.status).toBe(400);
      expect(listWorkItemsPaginatedMock).not.toHaveBeenCalled();
    });
  });

  it('returns Prisma detail by id', async () => {
    const row = createWorkItemListRow();
    getWorkItemDetailMock.mockResolvedValue(row);

    await withApp(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/workItems/${row.id}`);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual({
        data: JSON.parse(JSON.stringify(row)),
        error: null,
      });
      expect(getWorkItemDetailMock).toHaveBeenCalledWith(row.id);
    });
  });

  it('returns 404 when Prisma detail is missing', async () => {
    getWorkItemDetailMock.mockResolvedValue(null);
    const id = '22222222-2222-4222-8222-222222222222';

    await withApp(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/workItems/${id}`);
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body).toEqual({ data: null, error: 'Work item not found' });
    });
  });
});
