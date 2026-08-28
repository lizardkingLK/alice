import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  process.env.GITHUB_ACTIONS = 'true';
});

import express from 'express';
import type { Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { createTeamsRouter } from '../../src/routes/api/teams/teams.route';
import type { TeamsService } from '../../src/routes/api/teams/teams.service';

const { listTeamsPaginatedMock, getTeamDetailMock } = vi.hoisted(
  () => ({
    listTeamsPaginatedMock: vi.fn(),
    getTeamDetailMock: vi.fn(),
  })
);

vi.mock('../../src/middlewares/auth', () => ({
  requireApiAuth: (
    req: { userId?: string },
    _res: unknown,
    next: () => void
  ) => {
    req.userId = '11111111-1111-4111-8111-111111111111';
    next();
  },
}));

const teamsService = {
  listTeamsPaginated: listTeamsPaginatedMock,
  getTeamDetail: getTeamDetailMock,
} as unknown as TeamsService;

async function withApp(run: (baseUrl: string) => Promise<void>): Promise<void> {
  const app = express();
  app.disable('x-powered-by');
  app.use(
    '/api/teams',
    createTeamsRouter({ teamsService })
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

const mockTeamDetail = {
  id: '44444444-4444-4444-8444-444444444444',
  name: 'Backend Devs',
  description: 'Team description',
  manager_id: '11111111-1111-4111-8111-111111111111',
  project_id: '33333333-3333-4333-8333-333333333333',
  tech_stack: 'Node.js, Postgres',
  status: 'active',
  created_at: '2026-08-25T12:00:00.000Z',
  updated_at: '2026-08-25T12:00:00.000Z',
  manager: { id: '11111111-1111-4111-8111-111111111111', name: 'Manager', email: 'manager@example.com' },
  members: [],
};

describe('teams unused Prisma GET routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the paginated Prisma list envelope', async () => {
    const page = {
      teams: [mockTeamDetail],
      totalCount: 1,
      page: 1,
      limit: 10,
      totalPages: 1,
    };
    listTeamsPaginatedMock.mockResolvedValue(page);

    await withApp(async (baseUrl) => {
      const response = await fetch(
        `${baseUrl}/api/teams?status=active&search=Backend&projectId=${mockTeamDetail.project_id}`
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.totalCount).toBe(1);
      expect(body.teams[0].id).toBe(mockTeamDetail.id);
      expect(listTeamsPaginatedMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'active',
          search: 'Backend',
          projectId: mockTeamDetail.project_id,
          page: 1,
          limit: 10,
        }),
        '11111111-1111-4111-8111-111111111111'
      );
    });
  });

  it('rejects invalid list pagination', async () => {
    await withApp(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/teams?page=0`);
      expect(response.status).toBe(400);
      expect(listTeamsPaginatedMock).not.toHaveBeenCalled();
    });
  });

  it('returns Prisma detail by id', async () => {
    getTeamDetailMock.mockResolvedValue(mockTeamDetail);

    await withApp(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/teams/${mockTeamDetail.id}`);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual({
        data: JSON.parse(JSON.stringify(mockTeamDetail)),
        error: null,
      });
      expect(getTeamDetailMock).toHaveBeenCalledWith(mockTeamDetail.id, '11111111-1111-4111-8111-111111111111');
    });
  });

  it('returns 404 when team is missing', async () => {
    getTeamDetailMock.mockResolvedValue(null);
    const id = '22222222-2222-4222-8222-222222222222';

    await withApp(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/teams/${id}`);
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body).toEqual({ data: null, error: 'Team not found' });
    });
  });
});
