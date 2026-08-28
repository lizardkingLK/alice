import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { createSprintsRouter } from '../../src/routes/api/sprints/sprints.route';
import type {
  SprintsService,
  SprintBurndownService,
} from '../../src/routes/api/sprints/sprints.service';
import { createSprintListRow } from '../factories/sprint.factory';
import { SprintAccessError } from '../../src/routes/api/sprints/sprints.errors';

const {
  listSprintsPaginatedMock,
  getSprintDetailMock,
  createSprintMock,
  updateSprintStatusMock,
  updateSprintMock,
} = vi.hoisted(() => ({
  listSprintsPaginatedMock: vi.fn(),
  getSprintDetailMock: vi.fn(),
  createSprintMock: vi.fn(),
  updateSprintStatusMock: vi.fn(),
  updateSprintMock: vi.fn(),
}));

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

const sprintsService = {
  listSprintsPaginated: listSprintsPaginatedMock,
  getSprintDetail: getSprintDetailMock,
  createSprint: createSprintMock,
  updateSprintStatus: updateSprintStatusMock,
  updateSprint: updateSprintMock,
} as unknown as SprintsService;

const sprintBurndownService = {} as unknown as SprintBurndownService;

async function withApp(run: (baseUrl: string) => Promise<void>): Promise<void> {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json());
  app.use(
    '/api/sprints',
    createSprintsRouter({ sprintsService, sprintBurndownService })
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

describe('sprints unused Prisma GET routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the paginated Prisma list envelope', async () => {
    const page = {
      sprints: [createSprintListRow()],
      totalCount: 1,
      page: 1,
      limit: 5,
      totalPages: 1,
    };
    listSprintsPaginatedMock.mockResolvedValue(page);

    await withApp(async (baseUrl) => {
      const response = await fetch(
        `${baseUrl}/api/sprints?projectId=${page.sprints[0]!.project_id}`
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.totalCount).toBe(1);
      expect(body.sprints[0].id).toBe(page.sprints[0]!.id);
      expect(listSprintsPaginatedMock).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: page.sprints[0]!.project_id,
          page: 1,
          limit: 5,
        }),
        'user-1'
      );
    });
  });

  it('rejects invalid list pagination', async () => {
    await withApp(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/sprints?page=0`);
      expect(response.status).toBe(400);
      expect(listSprintsPaginatedMock).not.toHaveBeenCalled();
    });
  });

  it('returns Prisma detail by id', async () => {
    const row = createSprintListRow();
    getSprintDetailMock.mockResolvedValue(row);

    await withApp(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/sprints/${row.id}`);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual({
        data: JSON.parse(JSON.stringify(row)),
        error: null,
      });
      expect(getSprintDetailMock).toHaveBeenCalledWith(row.id, 'user-1');
    });
  });

  it('returns 404 when Prisma detail is missing', async () => {
    getSprintDetailMock.mockResolvedValue(null);
    const id = '22222222-2222-4222-8222-222222222222';

    await withApp(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/sprints/${id}`);
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body).toEqual({ data: null, error: 'Sprint not found' });
    });
  });

  it('returns 403 when access is denied', async () => {
    getSprintDetailMock.mockRejectedValue(new SprintAccessError());
    const id = '22222222-2222-4222-8222-222222222222';

    await withApp(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/sprints/${id}`);
      const body = await response.json();

      expect(response.status).toBe(403);
      expect(body).toEqual({
        data: null,
        error: "You're not a member of this project.",
      });
    });
  });
});

describe('sprints versioned POST and PATCH mutation routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a sprint successfully and returns response envelope', async () => {
    const sprintPayload = createSprintListRow();
    createSprintMock.mockResolvedValue(sprintPayload);

    const body = {
      name: 'Sprint Alpha',
      goal: 'Deliver items',
      projectId: '33333333-3333-4333-8333-333333333333',
      startDate: '2026-09-01',
      endDate: '2026-09-14',
    };

    await withApp(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/sprints`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await response.json();

      expect(response.status).toBe(201);
      expect(json).toEqual({
        data: JSON.parse(JSON.stringify(sprintPayload)),
        error: null,
      });
      expect(createSprintMock).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining(body)
      );
    });
  });

  it('returns 400 on invalid POST input validation', async () => {
    const body = {
      name: '', // Empty name triggers validation failure
      projectId: '33333333-3333-4333-8333-333333333333',
      startDate: '2026-09-01',
      endDate: '2026-09-14',
    };

    await withApp(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/sprints`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.data).toBeNull();
      expect(json.error).toBeDefined();
      expect(createSprintMock).not.toHaveBeenCalled();
    });
  });

  it('updates sprint status successfully and returns envelope', async () => {
    const sprintPayload = createSprintListRow({ status: 'active' });
    updateSprintStatusMock.mockResolvedValue(sprintPayload);

    const body = {
      status: 'active',
      expectedUpdatedAt: '2026-08-01T00:00:00.000Z',
    };

    await withApp(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/sprints/sprint-1/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json).toEqual({
        data: JSON.parse(JSON.stringify(sprintPayload)),
        error: null,
      });
      expect(updateSprintStatusMock).toHaveBeenCalledWith(
        'user-1',
        'sprint-1',
        'active',
        '2026-08-01T00:00:00.000Z'
      );
    });
  });

  it('updates sprint details successfully and returns envelope', async () => {
    const sprintPayload = createSprintListRow({ name: 'Updated name' });
    updateSprintMock.mockResolvedValue(sprintPayload);

    const body = {
      name: 'Updated name',
      projectId: '33333333-3333-4333-8333-333333333333',
      startDate: '2026-09-01',
      endDate: '2026-09-14',
      expectedUpdatedAt: '2026-08-01T00:00:00.000Z',
    };

    await withApp(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/sprints/sprint-1`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json).toEqual({
        data: JSON.parse(JSON.stringify(sprintPayload)),
        error: null,
      });
      expect(updateSprintMock).toHaveBeenCalledWith(
        'user-1',
        'sprint-1',
        expect.objectContaining({ name: 'Updated name' })
      );
    });
  });
});
