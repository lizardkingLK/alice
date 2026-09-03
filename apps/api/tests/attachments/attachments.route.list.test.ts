import { beforeEach, describe, expect, it, vi } from 'vitest';

const { listByWorkItemIdMock } = vi.hoisted(() => ({
  listByWorkItemIdMock: vi.fn(),
}));

vi.mock('../../src/middlewares/auth', async () => {
  const { mockRequireApiAuth } = await import('../helpers/mock-api-auth.js');
  return { requireApiAuth: mockRequireApiAuth };
});

vi.mock('../../src/routes/api/attachments/attachments.service', () => {
  class AttachmentNotFoundError extends Error {
    constructor(message = 'Attachment not found') {
      super(message);
      this.name = 'AttachmentNotFoundError';
    }
  }

  class AttachmentGoneError extends Error {
    constructor(message = 'Attachment file is no longer available') {
      super(message);
      this.name = 'AttachmentGoneError';
    }
  }

  class AttachmentsService {
    listByWorkItemId = listByWorkItemIdMock;
  }

  return { AttachmentNotFoundError, AttachmentGoneError, AttachmentsService };
});

import { createAttachmentsRouter } from '../../src/routes/api/attachments/attachments.route';
import type { AttachmentsService } from '../../src/routes/api/attachments/attachments.service';
import { WorkItemAccessError } from '../../src/routes/api/workItems/workItems.errors';
import { createAttachmentListRow } from '../factories/attachment.factory';
import { MOCK_AUTH_USER_ID } from '../helpers/mock-api-auth';
import { withMountedRouter } from '../helpers/route-test.harness';

const attachmentsService = {
  listByWorkItemId: listByWorkItemIdMock,
} as unknown as AttachmentsService;

const attachmentsRouter = createAttachmentsRouter({ attachmentsService });

describe('attachments unused Prisma list route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns attachment rows for a work item', async () => {
    const row = createAttachmentListRow();
    listByWorkItemIdMock.mockResolvedValue([row]);

    await withMountedRouter(
      '/api/attachments',
      attachmentsRouter,
      async (baseUrl) => {
        const response = await fetch(
          `${baseUrl}/api/attachments?work_item_id=${row.work_item_id}`
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

  it('rejects missing work_item_id', async () => {
    await withMountedRouter(
      '/api/attachments',
      attachmentsRouter,
      async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/attachments`);
        expect(response.status).toBe(400);
        expect(listByWorkItemIdMock).not.toHaveBeenCalled();
      }
    );
  });

  it('rejects invalid work_item_id', async () => {
    await withMountedRouter(
      '/api/attachments',
      attachmentsRouter,
      async (baseUrl) => {
        const response = await fetch(
          `${baseUrl}/api/attachments?work_item_id=not-a-uuid`
        );
        expect(response.status).toBe(400);
        expect(listByWorkItemIdMock).not.toHaveBeenCalled();
      }
    );
  });

  it('returns 404 when the work item is missing', async () => {
    listByWorkItemIdMock.mockRejectedValue(new Error('Work item not found'));

    await withMountedRouter(
      '/api/attachments',
      attachmentsRouter,
      async (baseUrl) => {
        const response = await fetch(
          `${baseUrl}/api/attachments?work_item_id=22222222-2222-4222-8222-222222222222`
        );
        expect(response.status).toBe(404);
      }
    );
  });

  it('returns 403 when the actor lacks project access', async () => {
    listByWorkItemIdMock.mockRejectedValue(new WorkItemAccessError());

    await withMountedRouter(
      '/api/attachments',
      attachmentsRouter,
      async (baseUrl) => {
        const response = await fetch(
          `${baseUrl}/api/attachments?work_item_id=22222222-2222-4222-8222-222222222222`
        );
        expect(response.status).toBe(403);
      }
    );
  });
});
