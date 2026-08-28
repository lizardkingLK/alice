import { beforeEach, describe, expect, it, vi } from 'vitest';

const { listByWorkItemIdMock, createWorkLogMock } = vi.hoisted(() => ({
  listByWorkItemIdMock: vi.fn(),
  createWorkLogMock: vi.fn(),
}));

vi.mock('../../src/middlewares/auth', async () => {
  const { mockRequireApiAuth } = await import('../helpers/mock-api-auth.js');
  return { requireApiAuth: mockRequireApiAuth };
});

vi.mock('../../src/routes/api/worklogs/worklogs.service', () => {
  class WorklogsService {
    listByWorkItemId = listByWorkItemIdMock;
    createWorkLog = createWorkLogMock;
  }

  return { WorklogsService };
});

import { createWorklogsRouter } from '../../src/routes/api/worklogs/worklogs.route';
import type { WorklogsService } from '../../src/routes/api/worklogs/worklogs.service';
import {
  WorkItemAccessError,
  WorkItemValidationError,
} from '../../src/routes/api/workItems/workItems.errors';
import { createWorkLogListRow } from '../factories/worklog.factory';
import { MOCK_AUTH_USER_ID } from '../helpers/mock-api-auth';
import { withMountedRouter } from '../helpers/route-test.harness';

const worklogsService = {
  listByWorkItemId: listByWorkItemIdMock,
  createWorkLog: createWorkLogMock,
} as unknown as WorklogsService;

const worklogsRouter = createWorklogsRouter({ worklogsService });

describe('worklogs routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns work log rows for a work item', async () => {
    const row = createWorkLogListRow();
    listByWorkItemIdMock.mockResolvedValue([row]);

    await withMountedRouter(
      '/api/worklogs',
      worklogsRouter,
      async (baseUrl) => {
        const response = await fetch(
          `${baseUrl}/api/worklogs?work_item_id=${row.work_item_id}`
        );
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toEqual(JSON.parse(JSON.stringify([row])));
        expect(listByWorkItemIdMock).toHaveBeenCalledWith(
          row.work_item_id,
          MOCK_AUTH_USER_ID
        );
      }
    );
  });

  it('rejects missing work_item_id on list', async () => {
    await withMountedRouter(
      '/api/worklogs',
      worklogsRouter,
      async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/worklogs`);
        expect(response.status).toBe(400);
        expect(listByWorkItemIdMock).not.toHaveBeenCalled();
      }
    );
  });

  it('returns 403 when list access is denied', async () => {
    listByWorkItemIdMock.mockRejectedValue(new WorkItemAccessError());

    await withMountedRouter(
      '/api/worklogs',
      worklogsRouter,
      async (baseUrl) => {
        const response = await fetch(
          `${baseUrl}/api/worklogs?work_item_id=22222222-2222-4222-8222-222222222222`
        );
        expect(response.status).toBe(403);
      }
    );
  });

  it('creates a work log', async () => {
    const row = createWorkLogListRow();
    createWorkLogMock.mockResolvedValue(row);

    await withMountedRouter(
      '/api/worklogs',
      worklogsRouter,
      async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/worklogs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            work_item_id: row.work_item_id,
            logged_hours: 2.5,
            logged_at: '2026-08-01',
            comment: 'Implemented API versioning',
          }),
        });
        const body = await response.json();

        expect(response.status).toBe(201);
        expect(body).toEqual({ worklog: JSON.parse(JSON.stringify(row)) });
        expect(createWorkLogMock).toHaveBeenCalledWith(
          MOCK_AUTH_USER_ID,
          expect.objectContaining({
            workItemId: row.work_item_id,
            loggedHours: 2.5,
            comment: 'Implemented API versioning',
          })
        );
      }
    );
  });

  it('rejects invalid create payloads', async () => {
    await withMountedRouter(
      '/api/worklogs',
      worklogsRouter,
      async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/worklogs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            work_item_id: 'not-a-uuid',
            logged_hours: 0,
          }),
        });

        expect(response.status).toBe(400);
        expect(createWorkLogMock).not.toHaveBeenCalled();
      }
    );
  });

  it('returns 400 when create is blocked for Done work items', async () => {
    createWorkLogMock.mockRejectedValue(
      new WorkItemValidationError(
        'Done work items are read-only except Status. Change status to log work.'
      )
    );

    await withMountedRouter(
      '/api/worklogs',
      worklogsRouter,
      async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/worklogs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            work_item_id: '22222222-2222-4222-8222-222222222222',
            logged_hours: 1,
          }),
        });

        expect(response.status).toBe(400);
      }
    );
  });
});
