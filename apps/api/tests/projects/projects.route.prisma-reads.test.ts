import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  process.env.GITHUB_ACTIONS = 'true';
});

// Mock supabase module to avoid real instantiation and websocket issues
vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          not: vi.fn().mockResolvedValue({ data: [], error: null }),
        })),
      })),
    })),
  },
}));

import express from 'express';
import type { Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { createProjectsRouter } from '../../src/routes/api/projects/projects.route';
import type { ProjectsService } from '../../src/routes/api/projects/projects.service';

const {
  listProjectsPaginatedMock,
  getProjectDetailMock,
  listProjectMembersPrismaMock,
} = vi.hoisted(() => ({
  listProjectsPaginatedMock: vi.fn(),
  getProjectDetailMock: vi.fn(),
  listProjectMembersPrismaMock: vi.fn(),
}));

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

const projectsService = {
  listProjectsPaginated: listProjectsPaginatedMock,
  getProjectDetail: getProjectDetailMock,
  listProjectMembersPrisma: listProjectMembersPrismaMock,
} as unknown as ProjectsService;

const workItemService = {
  createWorkItem: vi.fn(),
};

const jiraService = {
  fetchIssuesForProjectLink: vi.fn(),
};

async function withApp(run: (baseUrl: string) => Promise<void>): Promise<void> {
  const app = express();
  app.disable('x-powered-by');
  app.use(
    '/api/projects',
    createProjectsRouter({ projectsService, workItemService, jiraService })
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

const mockProjectDetail = {
  id: '33333333-3333-4333-8333-333333333333',
  name: 'Alice Project',
  key: 'ALICE',
  description: 'A description',
  status: 'active',
  owner_id: '11111111-1111-4111-8111-111111111111',
  start_date: '2026-08-25',
  end_date: '2026-08-30',
  created_at: '2026-08-25T12:00:00.000Z',
  updated_at: '2026-08-25T12:00:00.000Z',
  deleted_at: null,
  logo_url: null,
  cover_picture: null,
  github_token: 'secret-token',
  owner: {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Owner',
    email: 'owner@example.com',
  },
};

describe('projects unused Prisma GET routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the paginated Prisma list envelope', async () => {
    const page = {
      projects: [{ ...mockProjectDetail, team_count: 2 }],
      totalCount: 1,
      page: 1,
      limit: 10,
      totalPages: 1,
    };
    listProjectsPaginatedMock.mockResolvedValue(page);

    await withApp(async (baseUrl) => {
      const response = await fetch(
        `${baseUrl}/api/projects?status=active&search=Alice`
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.totalCount).toBe(1);
      expect(body.projects[0].id).toBe(mockProjectDetail.id);
      expect(listProjectsPaginatedMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'active',
          search: 'Alice',
          page: 1,
          limit: 10,
        }),
        '11111111-1111-4111-8111-111111111111'
      );
    });
  });

  it('rejects invalid list pagination', async () => {
    await withApp(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/projects?page=0`);
      expect(response.status).toBe(400);
      expect(listProjectsPaginatedMock).not.toHaveBeenCalled();
    });
  });

  it('returns Prisma detail by id without secret token', async () => {
    getProjectDetailMock.mockResolvedValue(mockProjectDetail);

    await withApp(async (baseUrl) => {
      const response = await fetch(
        `${baseUrl}/api/projects/${mockProjectDetail.id}`
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data.github_token).toBeUndefined();
      expect(body.data.has_github_token).toBe(true);
      expect(getProjectDetailMock).toHaveBeenCalledWith(
        mockProjectDetail.id,
        '11111111-1111-4111-8111-111111111111'
      );
    });
  });

  it('returns 404 when project is missing', async () => {
    getProjectDetailMock.mockResolvedValue(null);
    const id = '22222222-2222-4222-8222-222222222222';

    await withApp(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/projects/${id}`);
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body).toEqual({ data: null, error: 'Project not found' });
    });
  });

  it('returns list of project members', async () => {
    const members = [
      {
        project_id: '33333333-3333-4333-8333-333333333333',
        user_id: '11111111-1111-4111-8111-111111111111',
        status: 'active',
        user: { name: 'Bob' },
      },
    ];
    listProjectMembersPrismaMock.mockResolvedValue(members);

    await withApp(async (baseUrl) => {
      const response = await fetch(
        `${baseUrl}/api/projects/33333333-3333-4333-8333-333333333333/members`
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.members).toEqual(members);
      expect(listProjectMembersPrismaMock).toHaveBeenCalledWith(
        '33333333-3333-4333-8333-333333333333',
        '11111111-1111-4111-8111-111111111111'
      );
    });
  });
});
