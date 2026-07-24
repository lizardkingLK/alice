import { Router } from 'express';
import { z } from 'zod';
import {
  requireApiAuth,
  type AuthenticatedRequest,
} from '../../../middlewares/auth';
import { commentsService } from './comments.service';
import { createCommentSchema, updateCommentSchema } from './comments.schemas';

const commentsRouter: Router = Router();

commentsRouter.get('/', requireApiAuth, async (_req, res) => {
  try {
    const comments = await commentsService.listComments();
    res.json({ comments });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to retrieve comments';
    res.status(500).json({ error: message });
  }
});

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
        req.userId!
      );
      res.json({ comment: updated });
    } catch (error) {
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
    try {
      await commentsService.archiveComment(req.params.id!);
      res.json({ success: true });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to archive comment';
      res.status(500).json({ error: message });
    }
  }
);

export default commentsRouter;
