import { Router } from 'express';
import { z } from 'zod';
import {
  requireApiAuth,
  type AuthenticatedRequest,
} from '../../../middlewares/auth';
import { trySendOptimisticLockError } from '../../../lib/optimistic-lock';
import {
  commentLockActionSchema,
  createCommentSchema,
  toggleCommentReactionBodySchema,
  updateCommentSchema,
} from './comments.schemas';
import { CommentsService } from './comments.service';
import { listCommentsQuerySchema } from '@repo/types';
import { CommentAccessError, CommentReplyScopeError } from './comments.errors';

function sendCommentError(
  res: Parameters<typeof trySendOptimisticLockError>[0],
  error: unknown,
  fallback: string
): void {
  if (trySendOptimisticLockError(res, error)) {
    return;
  }
  if (error instanceof CommentAccessError) {
    res.status(403).json({ data: null, error: error.message });
    return;
  }
  if (error instanceof CommentReplyScopeError) {
    res.status(400).json({ data: null, error: error.message });
    return;
  }
  const message = error instanceof Error ? error.message : fallback;
  const status = /not found/i.test(message) ? 404 : 500;
  res.status(status).json({ data: null, error: message });
}

function firstQueryValue(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value) && typeof value[0] === 'string') {
    return value[0];
  }
  return undefined;
}

function listCommentsQueryFromRequest(query: Record<string, unknown>) {
  return listCommentsQuerySchema.safeParse({
    page: firstQueryValue(query.page),
    limit: firstQueryValue(query.limit),
    workItemId: firstQueryValue(query.workItemId),
  });
}

function parseCommentId(
  res: Parameters<typeof trySendOptimisticLockError>[0],
  rawId: string | undefined
): string | null {
  const parsed = z.uuid().safeParse(rawId);
  if (!parsed.success) {
    res.status(400).json({ data: null, error: 'Invalid comment id' });
    return null;
  }
  return parsed.data;
}

export type CommentsRouterDeps = {
  commentsService: CommentsService;
};

export function createCommentsRouter(deps: CommentsRouterDeps) {
  const { commentsService } = deps;

  const commentsRouter: Router = Router();

  commentsRouter.get(
    '/',
    requireApiAuth,
    async (req: AuthenticatedRequest, res) => {
      const parsed = listCommentsQueryFromRequest(
        req.query as Record<string, unknown>
      );
      if (!parsed.success) {
        return res.status(400).json({ error: z.treeifyError(parsed.error) });
      }

      try {
        const result = await commentsService.listCommentsPaginated(
          parsed.data,
          req.userId!
        );
        res.json(result);
      } catch (error) {
        if (error instanceof CommentAccessError) {
          return res.status(403).json({ error: error.message });
        }
        const message =
          error instanceof Error ? error.message : 'Failed to list comments';
        res.status(500).json({ error: message });
      }
    }
  );

  commentsRouter.get(
    '/:id',
    requireApiAuth,
    async (req: AuthenticatedRequest, res) => {
      const commentId = parseCommentId(res, req.params.id);
      if (!commentId) {
        return;
      }

      try {
        const comment = await commentsService.getCommentDetail(
          commentId,
          req.userId!
        );
        if (!comment) {
          return res
            .status(404)
            .json({ data: null, error: 'Comment not found' });
        }
        res.json({ data: comment, error: null });
      } catch (error) {
        if (error instanceof CommentAccessError) {
          return res.status(403).json({ data: null, error: error.message });
        }
        const message =
          error instanceof Error ? error.message : 'Failed to get comment';
        res.status(500).json({ data: null, error: message });
      }
    }
  );

  commentsRouter.post(
    '/',
    requireApiAuth,
    async (req: AuthenticatedRequest, res) => {
      const validation = createCommentSchema.safeParse(req.body);
      if (!validation.success) {
        const errorMsg = z.treeifyError(validation.error);
        return res.status(400).json({ data: null, error: errorMsg });
      }

      try {
        const created = await commentsService.createComment(
          req.userId!,
          validation.data
        );
        res.status(201).json({ data: created, error: null });
      } catch (error) {
        sendCommentError(res, error, 'Failed to create comment');
      }
    }
  );

  commentsRouter.patch(
    '/:id',
    requireApiAuth,
    async (req: AuthenticatedRequest, res) => {
      const commentId = parseCommentId(res, req.params.id);
      if (!commentId) {
        return;
      }
      const validation = updateCommentSchema.safeParse(req.body);
      if (!validation.success) {
        const errorMsg = z.treeifyError(validation.error);
        return res.status(400).json({ data: null, error: errorMsg });
      }

      try {
        const updated = await commentsService.updateComment(
          commentId,
          validation.data.content,
          validation.data.expectedUpdatedAt,
          req.userId!
        );
        res.json({ data: updated, error: null });
      } catch (error) {
        sendCommentError(res, error, 'Failed to update comment');
      }
    }
  );

  commentsRouter.delete(
    '/:id',
    requireApiAuth,
    async (req: AuthenticatedRequest, res) => {
      const commentId = parseCommentId(res, req.params.id);
      if (!commentId) {
        return;
      }
      const permanent = req.query.permanent === 'true';

      if (!permanent) {
        const validation = commentLockActionSchema.safeParse(req.body);
        if (!validation.success) {
          return res
            .status(400)
            .json({ data: null, error: z.treeifyError(validation.error) });
        }

        try {
          const accepted = await commentsService.enqueueArchiveComment(
            req.userId!,
            req.params.id!,
            validation.data.expectedUpdatedAt
          );
          // 202 — archive finishes in the background; inbox notifies on result.
          return res.status(202).json({
            accepted: true,
            message: accepted.message,
            correlationId: accepted.correlationId,
          });
        } catch (error) {
          sendCommentError(res, error, 'Failed to delete comment');
          return;
        }
      }

      try {
        const accepted = await commentsService.enqueueHardDeleteComment(
          req.userId!,
          req.params.id!
        );
        // 202 — purge finishes in the background; inbox notifies on result.
        res.status(202).json({
          accepted: true,
          message: accepted.message,
          correlationId: accepted.correlationId,
        });
      } catch (error) {
        sendCommentError(res, error, 'Failed to delete comment');
      }
    }
  );

  commentsRouter.post(
    '/:id/restore',
    requireApiAuth,
    async (req: AuthenticatedRequest, res) => {
      const commentId = parseCommentId(res, req.params.id);
      if (!commentId) {
        return;
      }
      const validation = commentLockActionSchema.safeParse(req.body);
      if (!validation.success) {
        return res
          .status(400)
          .json({ data: null, error: z.treeifyError(validation.error) });
      }

      try {
        await commentsService.restoreComment(
          commentId,
          validation.data.expectedUpdatedAt,
          req.userId!
        );
        res.json({ data: { success: true }, error: null });
      } catch (error) {
        sendCommentError(res, error, 'Failed to restore comment');
      }
    }
  );

  commentsRouter.post(
    '/:id/reactions',
    requireApiAuth,
    async (req: AuthenticatedRequest, res) => {
      const commentId = parseCommentId(res, req.params.id);
      if (!commentId) {
        return;
      }

      const validation = toggleCommentReactionBodySchema.safeParse(req.body);
      if (!validation.success) {
        return res
          .status(400)
          .json({ data: null, error: z.treeifyError(validation.error) });
      }

      try {
        const updated = await commentsService.toggleCommentReaction(
          commentId,
          req.userId!,
          validation.data.emoji,
          validation.data.action
        );
        res.json({ data: updated, error: null });
      } catch (error) {
        if (error instanceof CommentAccessError) {
          return res.status(403).json({ data: null, error: error.message });
        }
        const message =
          error instanceof Error
            ? error.message
            : 'Failed to update comment reaction';
        const status = message === 'Comment not found' ? 404 : 500;
        res.status(status).json({ data: null, error: message });
      }
    }
  );

  return commentsRouter;
}
