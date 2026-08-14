import { Router } from 'express';
import { z } from 'zod';
import {
  requireApiAuth,
  type AuthenticatedRequest,
} from '../../../middlewares/auth';
import { trySendOptimisticLockError } from '../../../lib/optimistic-lock';
import { commentsService } from './comments.service';
import {
  commentLockActionSchema,
  createCommentSchema,
  updateCommentSchema,
} from './comments.schemas';

const commentsRouter: Router = Router();

commentsRouter.post(
  '/',
  requireApiAuth,
  async (req: AuthenticatedRequest, res) => {
    const validation = createCommentSchema.safeParse(req.body);
    if (!validation.success) {
      const errorMsg = z.treeifyError(validation.error);
      return res.status(400).json({ error: errorMsg });
    }

    try {
      const created = await commentsService.createComment(
        req.userId!,
        validation.data
      );
      res.status(201).json({ comment: created });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to create comment';
      res.status(500).json({ error: message });
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
      return res.status(400).json({ error: errorMsg });
    }

    try {
      const updated = await commentsService.updateComment(
        req.params.id!,
        validation.data.content,
        validation.data.expectedUpdatedAt,
        req.userId!
      );
      res.json({ comment: updated });
    } catch (error) {
      if (trySendOptimisticLockError(res, error)) return;
      const message =
        error instanceof Error ? error.message : 'Failed to update comment';
      res.status(500).json({ error: message });
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
          .json({ error: z.treeifyError(validation.error) });
      }

      try {
        await commentsService.archiveComment(
          req.params.id!,
          validation.data.expectedUpdatedAt
        );
        return res.json({ success: true });
      } catch (error) {
        if (trySendOptimisticLockError(res, error)) return;
        const message =
          error instanceof Error ? error.message : 'Failed to delete comment';
        return res.status(500).json({ error: message });
      }
    }

    try {
      await commentsService.hardDeleteComment(req.params.id!);
      res.json({ success: true });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to delete comment';
      res.status(500).json({ error: message });
    }
  }
);

commentsRouter.post(
  '/:id/restore',
  requireApiAuth,
  async (req: AuthenticatedRequest, res) => {
    const validation = commentLockActionSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: z.treeifyError(validation.error) });
    }

    try {
      await commentsService.restoreComment(
        req.params.id!,
        validation.data.expectedUpdatedAt
      );
      res.json({ success: true });
    } catch (error) {
      if (trySendOptimisticLockError(res, error)) return;
      const message =
        error instanceof Error ? error.message : 'Failed to restore comment';
      res.status(500).json({ error: message });
    }
  }
);

export default commentsRouter;
