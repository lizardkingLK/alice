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
  updateCommentSchema,
} from './comments.schemas';
import { CommentsService } from './comments.service';
import { listCommentsQuerySchema } from '@repo/types';
import { CommentAccessError } from './comments.errors';

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
      const parsedId = z.uuid().safeParse(req.params.id);
      if (!parsedId.success) {
        return res
          .status(400)
          .json({ data: null, error: 'Invalid comment id' });
      }

      try {
        const comment = await commentsService.getCommentDetail(
          parsedId.data,
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
        const message =
          error instanceof Error ? error.message : 'Failed to create comment';
        res.status(500).json({ data: null, error: message });
      }
    }
  );

  commentsRouter.patch(
    '/:id',
    requireApiAuth,
    async (req: AuthenticatedRequest, res) => {
      const validation = updateCommentSchema.safeParse(req.body);
      if (!validation.success) {
        const errorMsg = z.treeifyError(validation.error);
        return res.status(400).json({ data: null, error: errorMsg });
      }

      try {
        const updated = await commentsService.updateComment(
          req.params.id!,
          validation.data.content,
          validation.data.expectedUpdatedAt,
          req.userId!
        );
        res.json({ data: updated, error: null });
      } catch (error) {
        if (trySendOptimisticLockError(res, error)) return;
        const message =
          error instanceof Error ? error.message : 'Failed to update comment';
        res.status(500).json({ data: null, error: message });
      }
    }
  );

  commentsRouter.delete(
    '/:id',
    requireApiAuth,
    async (req: AuthenticatedRequest, res) => {
      const permanent = req.query.permanent === 'true';

      if (!permanent) {
        const validation = commentLockActionSchema.safeParse(req.body);
        if (!validation.success) {
          return res
            .status(400)
            .json({ data: null, error: z.treeifyError(validation.error) });
        }

        try {
          await commentsService.archiveComment(
            req.params.id!,
            validation.data.expectedUpdatedAt
          );
          return res.json({ data: { success: true }, error: null });
        } catch (error) {
          if (trySendOptimisticLockError(res, error)) return;
          const message =
            error instanceof Error ? error.message : 'Failed to delete comment';
          return res.status(500).json({ data: null, error: message });
        }
      }

      try {
        await commentsService.hardDeleteComment(req.params.id!);
        res.json({ data: { success: true }, error: null });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Failed to delete comment';
        res.status(500).json({ data: null, error: message });
      }
    }
  );

  commentsRouter.post(
    '/:id/restore',
    requireApiAuth,
    async (req: AuthenticatedRequest, res) => {
      const validation = commentLockActionSchema.safeParse(req.body);
      if (!validation.success) {
        return res
          .status(400)
          .json({ data: null, error: z.treeifyError(validation.error) });
      }

      try {
        await commentsService.restoreComment(
          req.params.id!,
          validation.data.expectedUpdatedAt
        );
        res.json({ data: { success: true }, error: null });
      } catch (error) {
        if (trySendOptimisticLockError(res, error)) return;
        const message =
          error instanceof Error ? error.message : 'Failed to restore comment';
        res.status(500).json({ data: null, error: message });
      }
    }
  );

  return commentsRouter;
}
