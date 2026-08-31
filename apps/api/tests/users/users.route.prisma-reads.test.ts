import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { createUsersRouter } from '../../src/routes/api/users/users.route';
import type { UsersService } from '../../src/routes/api/users/users.service';

const {
  listUsersPaginatedMock,
  getUserDetailMock,
} = vi.hoisted(() => ({
  listUsersPaginatedMock: vi.fn(),
  getUserDetailMock: vi.fn(),
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

const usersService = {
  listUsersPaginated: listUsersPaginatedMock,
  getUserDetail: getUserDetailMock,
} as unknown as UsersService;

async function withApp(run: (baseUrl: string) => Promise<void>): Promise<void> {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json());
  app.use(
    '/api/users',
    createUsersRouter({ usersService })
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

function createTestUserRow(overrides = {}) {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    role: 'member',
    active: true,
    membership_status: 'active',
    profile_picture: null,
    cover_picture: null,
    created_at: '2026-08-30T10:00:00.000Z',
    updated_at: '2026-08-30T10:00:00.000Z',
    created_by: null,
    updated_by: null,
    ...overrides,
  };
}

describe('users versioned GET routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns paginated list of users', async () => {
    const page = {
      users: [createTestUserRow()],
      totalCount: 1,
      page: 1,
      limit: 10,
      totalPages: 1,
    };
    listUsersPaginatedMock.mockResolvedValue(page);

    await withApp(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/users?role=member&active=true&search=Ada`);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.totalCount).toBe(1);
      expect(body.users[0].id).toBe(page.users[0]!.id);
      expect(listUsersPaginatedMock).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 1,
          limit: 10,
          role: 'member',
          active: true,
          search: 'Ada',
        })
      );
    });
  });

  it('rejects invalid list parameters', async () => {
    await withApp(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/users?page=0`);
      expect(response.status).toBe(400);
      expect(listUsersPaginatedMock).not.toHaveBeenCalled();
    });
  });

  it('returns user details by ID', async () => {
    const userRow = createTestUserRow();
    getUserDetailMock.mockResolvedValue(userRow);

    await withApp(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/users/${userRow.id}`);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual({
        user: JSON.parse(JSON.stringify(userRow)),
      });
      expect(getUserDetailMock).toHaveBeenCalledWith(userRow.id);
    });
  });

  it('returns 404 when user detail is missing', async () => {
    getUserDetailMock.mockResolvedValue(null);
    const id = '22222222-2222-4222-8222-222222222222';

    await withApp(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/users/${id}`);
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body).toEqual({ error: 'User not found.' });
    });
  });

  it('returns 400 on invalid user ID format', async () => {
    await withApp(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/users/not-a-uuid`);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body).toEqual({ error: 'Invalid user ID.' });
    });
  });
});
