import { beforeEach, describe, expect, it, vi } from 'vitest';

const { listAccessAllowlistPaginatedMock, createMock } = vi.hoisted(() => ({
  listAccessAllowlistPaginatedMock: vi.fn(),
  createMock: vi.fn(),
}));

vi.mock('../../src/middlewares/auth', async () => {
  const { mockRequireApiAuth } = await import('../helpers/mock-api-auth.js');
  return { requireApiAuth: mockRequireApiAuth };
});

vi.mock(
  '../../src/routes/api/access-allowlist/access-allowlist.service',
  () => {
    class AccessAllowlistService {
      listAccessAllowlistPaginated = listAccessAllowlistPaginatedMock;
      createAccessAllowlist = createMock;
    }

    return { AccessAllowlistService };
  }
);

import { createAccessAllowlistRouter } from '../../src/routes/api/access-allowlist/access-allowlist.route';
import type { AccessAllowlistService } from '../../src/routes/api/access-allowlist/access-allowlist.service';
import { MOCK_AUTH_USER_ID } from '../helpers/mock-api-auth';
import { withMountedRouter } from '../helpers/route-test.harness';

const allowlistMount = '/api/v1/access-allowlist';

const accessAllowlistService = {
  listAccessAllowlistPaginated: listAccessAllowlistPaginatedMock,
  createAccessAllowlist: createMock,
} as unknown as AccessAllowlistService;

const accessAllowlistRouter = createAccessAllowlistRouter({
  accessAllowlistService,
});

async function withAllowlistRouter(
  run: (baseUrl: string) => Promise<void>
): Promise<void> {
  await withMountedRouter(allowlistMount, accessAllowlistRouter, run);
}

async function requestAllowlist(
  baseUrl: string,
  subpath: string,
  init?: RequestInit
) {
  const response = await fetch(`${baseUrl}${allowlistMount}${subpath}`, init);
  const body = await response.json();
  return { response, body };
}

describe('access-allowlist GET /', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists paginated entries for an admin actor', async () => {
    listAccessAllowlistPaginatedMock.mockResolvedValue({
      items: [],
      totalCount: 0,
      page: 2,
      limit: 5,
      totalPages: 1,
    });

    await withAllowlistRouter(async (baseUrl) => {
      const { response, body } = await requestAllowlist(
        baseUrl,
        '?page=2&limit=5&search=acme&status=all'
      );
      expect(response.status).toBe(200);
      expect(body).toEqual({
        items: [],
        totalCount: 0,
        page: 2,
        limit: 5,
        totalPages: 1,
      });
    });

    expect(listAccessAllowlistPaginatedMock).toHaveBeenCalledWith(
      MOCK_AUTH_USER_ID,
      { page: 2, limit: 5, search: 'acme', status: 'all' }
    );
  });

  it('returns 400 for an invalid status query', async () => {
    await withAllowlistRouter(async (baseUrl) => {
      const { response } = await requestAllowlist(baseUrl, '?status=bogus');
      expect(response.status).toBe(400);
    });

    expect(listAccessAllowlistPaginatedMock).not.toHaveBeenCalled();
  });
});

describe('access-allowlist POST /', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passes an access request id into email approval', async () => {
    const entry = {
      id: 'allow-1',
      kind: 'email',
      value: 'guest@partner.com',
      status: 'active',
    };
    createMock.mockResolvedValue(entry);

    await withAllowlistRouter(async (baseUrl) => {
      const { response, body } = await requestAllowlist(baseUrl, '', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          kind: 'email',
          value: ' Guest@Partner.com ',
          requestId: '019a31d2-a14a-7677-88a5-f82fc71fd5d7',
        }),
      });

      expect(response.status).toBe(201);
      expect(body).toEqual({ entry });
    });

    expect(createMock).toHaveBeenCalledWith(MOCK_AUTH_USER_ID, {
      kind: 'email',
      value: 'guest@partner.com',
      requestId: '019a31d2-a14a-7677-88a5-f82fc71fd5d7',
      allowed_project_ids: null,
    });
  });
});
