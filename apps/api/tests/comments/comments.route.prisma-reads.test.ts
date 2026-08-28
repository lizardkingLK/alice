import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { createCommentsRouter } from '../../src/routes/api/comments/comments.route';
import type { CommentsService } from '../../src/routes/api/comments/comments.service';
import { createCommentListRow } from '../factories/comment.factory';
import { CommentAccessError } from '../../src/routes/api/comments/comments.errors';

const {
  listCommentsPaginatedMock,
  getCommentDetailMock,
  createCommentMock,
  updateCommentMock,
  archiveCommentMock,
  restoreCommentMock,
  hardDeleteCommentMock,
} = vi.hoisted(() => ({
  listCommentsPaginatedMock: vi.fn(),
  getCommentDetailMock: vi.fn(),
  createCommentMock: vi.fn(),
  updateCommentMock: vi.fn(),
  archiveCommentMock: vi.fn(),
  restoreCommentMock: vi.fn(),
  hardDeleteCommentMock: vi.fn(),
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

const commentsService = {
  listCommentsPaginated: listCommentsPaginatedMock,
  getCommentDetail: getCommentDetailMock,
  createComment: createCommentMock,
  updateComment: updateCommentMock,
  archiveComment: archiveCommentMock,
  restoreComment: restoreCommentMock,
  hardDeleteComment: hardDeleteCommentMock,
} as unknown as CommentsService;

async function withApp(run: (baseUrl: string) => Promise<void>): Promise<void> {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json());
  app.use('/api/comments', createCommentsRouter({ commentsService }));

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

describe('comments routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET routes', () => {
    it('returns the paginated Prisma list envelope', async () => {
      const page = {
        comments: [createCommentListRow()],
        totalCount: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      };
      listCommentsPaginatedMock.mockResolvedValue(page);

      await withApp(async (baseUrl) => {
        const response = await fetch(
          `${baseUrl}/api/comments?workItemId=${page.comments[0]!.work_item_id}`
        );
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.totalCount).toBe(1);
        expect(body.comments[0].id).toBe(page.comments[0]!.id);
        expect(listCommentsPaginatedMock).toHaveBeenCalledWith(
          expect.objectContaining({
            workItemId: page.comments[0]!.work_item_id,
            page: 1,
            limit: 10,
          }),
          'user-1'
        );
      });
    });

    it('handles CommentAccessError on list with 403', async () => {
      listCommentsPaginatedMock.mockRejectedValue(
        new CommentAccessError('Access denied')
      );

      await withApp(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/comments`);
        const body = await response.json();

        expect(response.status).toBe(403);
        expect(body.error).toBe('Access denied');
      });
    });

    it('returns single comment detail by ID', async () => {
      const comment = createCommentListRow();
      getCommentDetailMock.mockResolvedValue(comment);

      await withApp(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/comments/${comment.id}`);
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.data.id).toBe(comment.id);
        expect(body.error).toBeNull();
        expect(getCommentDetailMock).toHaveBeenCalledWith(comment.id, 'user-1');
      });
    });

    it('returns 404 when comment is not found', async () => {
      getCommentDetailMock.mockResolvedValue(null);

      await withApp(async (baseUrl) => {
        const response = await fetch(
          `${baseUrl}/api/comments/00000000-0000-0000-0000-000000000000`
        );
        const body = await response.json();

        expect(response.status).toBe(404);
        expect(body.data).toBeNull();
        expect(body.error).toBe('Comment not found');
      });
    });

    it('returns 400 for invalid comment ID', async () => {
      await withApp(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/comments/invalid-id`);
        const body = await response.json();

        expect(response.status).toBe(400);
        expect(body.data).toBeNull();
        expect(body.error).toBe('Invalid comment id');
      });
    });

    it('handles CommentAccessError on detail lookup with 403', async () => {
      getCommentDetailMock.mockRejectedValue(
        new CommentAccessError('No access')
      );

      await withApp(async (baseUrl) => {
        const response = await fetch(
          `${baseUrl}/api/comments/00000000-0000-0000-0000-000000000000`
        );
        const body = await response.json();

        expect(response.status).toBe(403);
        expect(body.data).toBeNull();
        expect(body.error).toBe('No access');
      });
    });
  });

  describe('Mutation routes', () => {
    it('handles POST / (create comment)', async () => {
      const comment = createCommentListRow();
      createCommentMock.mockResolvedValue(comment);

      await withApp(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/comments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            work_item_id: comment.work_item_id,
            content: {
              type: 'doc',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Hello' }],
                },
              ],
            },
          }),
        });
        const body = await response.json();

        expect(response.status).toBe(201);
        expect(body.data.id).toBe(comment.id);
        expect(body.error).toBeNull();
        expect(createCommentMock).toHaveBeenCalledWith(
          'user-1',
          expect.objectContaining({
            work_item_id: comment.work_item_id,
          })
        );
      });
    });

    it('handles PATCH /:id (update comment)', async () => {
      const comment = createCommentListRow();
      updateCommentMock.mockResolvedValue(comment);

      await withApp(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/comments/${comment.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: {
              type: 'doc',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Updated content' }],
                },
              ],
            },
            expectedUpdatedAt: new Date().toISOString(),
          }),
        });
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.data.id).toBe(comment.id);
        expect(body.error).toBeNull();
        expect(updateCommentMock).toHaveBeenCalledWith(
          comment.id,
          expect.any(Object),
          expect.any(String),
          'user-1'
        );
      });
    });

    it('handles DELETE /:id (archive comment)', async () => {
      await withApp(async (baseUrl) => {
        const response = await fetch(
          `${baseUrl}/api/comments/44444444-4444-4444-8444-444444444444`,
          {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              expectedUpdatedAt: new Date().toISOString(),
            }),
          }
        );
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.data.success).toBe(true);
        expect(body.error).toBeNull();
        expect(archiveCommentMock).toHaveBeenCalledWith(
          '44444444-4444-4444-8444-444444444444',
          expect.any(String)
        );
      });
    });

    it('handles DELETE /:id?permanent=true (hard delete)', async () => {
      await withApp(async (baseUrl) => {
        const response = await fetch(
          `${baseUrl}/api/comments/44444444-4444-4444-8444-444444444444?permanent=true`,
          {
            method: 'DELETE',
          }
        );
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.data.success).toBe(true);
        expect(body.error).toBeNull();
        expect(hardDeleteCommentMock).toHaveBeenCalledWith(
          '44444444-4444-4444-8444-444444444444'
        );
      });
    });

    it('handles POST /:id/restore (restore comment)', async () => {
      await withApp(async (baseUrl) => {
        const response = await fetch(
          `${baseUrl}/api/comments/44444444-4444-4444-8444-444444444444/restore`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              expectedUpdatedAt: new Date().toISOString(),
            }),
          }
        );
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.data.success).toBe(true);
        expect(body.error).toBeNull();
        expect(restoreCommentMock).toHaveBeenCalledWith(
          '44444444-4444-4444-8444-444444444444',
          expect.any(String)
        );
      });
    });
  });
});
