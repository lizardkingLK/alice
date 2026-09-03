import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  createMock,
  updateMock,
  archiveMock,
  restoreMock,
  hardDeleteMock,
  deleteShareMock,
  shareMock,
} = vi.hoisted(() => ({
  createMock: vi.fn(),
  updateMock: vi.fn(),
  archiveMock: vi.fn(),
  restoreMock: vi.fn(),
  hardDeleteMock: vi.fn(),
  deleteShareMock: vi.fn(),
  shareMock: vi.fn(),
}));

vi.mock('../../src/middlewares/auth', async () => {
  const { mockRequireApiAuth } = await import('../helpers/mock-api-auth.js');
  return { requireApiAuth: mockRequireApiAuth };
});

vi.mock('../../src/routes/api/savedViews/savedViews.service', () => {
  class SavedViewsService {
    create = createMock;
    update = updateMock;
    archive = archiveMock;
    restore = restoreMock;
    hardDelete = hardDeleteMock;
    deleteShare = deleteShareMock;
    share = shareMock;
  }

  return { SavedViewsService };
});

import { createSavedViewsRouter } from '../../src/routes/api/savedViews/savedViews.route';
import type { SavedViewsService } from '../../src/routes/api/savedViews/savedViews.service';
import { MOCK_AUTH_USER_ID } from '../helpers/mock-api-auth';
import { withMountedRouter } from '../helpers/route-test.harness';

const savedViewsMount = '/api/v1/saved-views';

const savedViewsService = {
  create: createMock,
  update: updateMock,
  archive: archiveMock,
  restore: restoreMock,
  hardDelete: hardDeleteMock,
  deleteShare: deleteShareMock,
  share: shareMock,
} as unknown as SavedViewsService;

const savedViewsRouter = createSavedViewsRouter({ savedViewsService });

const savedViewWire = {
  id: '11111111-1111-4111-8111-111111111111',
  owner_id: MOCK_AUTH_USER_ID,
  title: 'My view',
  description: null,
  pathname: '/backlog',
  search: '',
  project_id: null,
  status: 'active',
  created_by: MOCK_AUTH_USER_ID,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_by: MOCK_AUTH_USER_ID,
  updated_at: '2026-01-01T00:00:00.000Z',
};

async function withSavedViewsRouter(
  run: (baseUrl: string) => Promise<void>
): Promise<void> {
  await withMountedRouter(savedViewsMount, savedViewsRouter, run);
}

async function requestSavedViews(
  baseUrl: string,
  subpath: string,
  init?: RequestInit
) {
  const response = await fetch(`${baseUrl}${savedViewsMount}${subpath}`, init);
  const body = await response.json();
  return { response, body };
}

describe('savedViews routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a saved view with a validated body', async () => {
    createMock.mockResolvedValue(savedViewWire);

    await withSavedViewsRouter(async (baseUrl) => {
      const { response, body } = await requestSavedViews(baseUrl, '', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'My view',
          pathname: '/backlog',
        }),
      });

      expect(response.status).toBe(201);
      expect(body).toEqual({ data: savedViewWire });
      expect(createMock).toHaveBeenCalledWith(MOCK_AUTH_USER_ID, {
        title: 'My view',
        pathname: '/backlog',
        search: '',
      });
    });
  });

  it('returns 400 for invalid create payloads', async () => {
    await withSavedViewsRouter(async (baseUrl) => {
      const { response } = await requestSavedViews(baseUrl, '', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: '   ' }),
      });

      expect(response.status).toBe(400);
      expect(createMock).not.toHaveBeenCalled();
    });
  });

  it('archives an owned saved view', async () => {
    archiveMock.mockResolvedValue({ ...savedViewWire, status: 'archived' });

    await withSavedViewsRouter(async (baseUrl) => {
      const { response, body } = await requestSavedViews(
        baseUrl,
        `/${savedViewWire.id}/archive`,
        { method: 'POST' }
      );

      expect(response.status).toBe(200);
      expect(body.data.status).toBe('archived');
      expect(archiveMock).toHaveBeenCalledWith(
        MOCK_AUTH_USER_ID,
        savedViewWire.id
      );
    });
  });

  it('shares a saved view with validated recipients', async () => {
    shareMock.mockResolvedValue({
      view: savedViewWire,
      recipientCount: 1,
    });

    await withSavedViewsRouter(async (baseUrl) => {
      const { response, body } = await requestSavedViews(
        baseUrl,
        `/${savedViewWire.id}/share`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userIds: ['33333333-3333-4333-8333-333333333333'],
          }),
        }
      );

      expect(response.status).toBe(200);
      expect(body.data.recipientCount).toBe(1);
      expect(shareMock).toHaveBeenCalledWith(
        MOCK_AUTH_USER_ID,
        savedViewWire.id,
        { userIds: ['33333333-3333-4333-8333-333333333333'] }
      );
    });
  });

  it('hard-deletes an archived saved view', async () => {
    hardDeleteMock.mockResolvedValue(undefined);

    await withSavedViewsRouter(async (baseUrl) => {
      const { response, body } = await requestSavedViews(
        baseUrl,
        `/${savedViewWire.id}`,
        { method: 'DELETE' }
      );

      expect(response.status).toBe(200);
      expect(body).toEqual({ success: true });
      expect(hardDeleteMock).toHaveBeenCalledWith(
        MOCK_AUTH_USER_ID,
        savedViewWire.id
      );
    });
  });
});
