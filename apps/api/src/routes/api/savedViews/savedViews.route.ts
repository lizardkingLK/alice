import { Router, type Response } from 'express';
import { z } from 'zod';
import {
  requireApiAuth,
  type AuthenticatedRequest,
} from '../../../middlewares/auth';
import {
  createSavedViewSchema,
  savedViewStatusQuerySchema,
  shareSavedViewSchema,
  updateSavedViewSchema,
} from './savedViews.schemas';
import { savedViewsService } from './savedViews.service';

const savedViewsRouter: Router = Router();

function sendError(res: Response, error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  let status = 500;
  if (message === 'Forbidden') {
    status = 403;
  } else if (
    message === 'Saved view not found' ||
    message === 'Shared view not found'
  ) {
    status = 404;
  } else if (message === 'Only archived views can be permanently deleted') {
    status = 400;
  }
  res.status(status).json({ error: message });
}

function postOwnedViewStatusAction(
  action: 'archive' | 'restore',
  failureMessage: string
) {
  return async (req: AuthenticatedRequest, res: Response) => {
    try {
      const view =
        action === 'archive'
          ? await savedViewsService.archive(req.userId!, req.params.id!)
          : await savedViewsService.restore(req.userId!, req.params.id!);
      res.json({ data: view });
    } catch (error) {
      sendError(res, error, failureMessage);
    }
  };
}

savedViewsRouter.get(
  '/',
  requireApiAuth,
  async (req: AuthenticatedRequest, res) => {
    try {
      const statusParse = savedViewStatusQuerySchema.safeParse(
        req.query.status ?? 'active'
      );
      if (!statusParse.success) {
        return res.status(400).json({ error: 'Invalid status' });
      }
      const views = await savedViewsService.listOwned(
        req.userId!,
        statusParse.data
      );
      res.json({ data: views });
    } catch (error) {
      sendError(res, error, 'Failed to list saved views');
    }
  }
);

savedViewsRouter.get(
  '/shared-with-me',
  requireApiAuth,
  async (req: AuthenticatedRequest, res) => {
    try {
      const views = await savedViewsService.listSharedWithMe(req.userId!);
      res.json({ data: views });
    } catch (error) {
      sendError(res, error, 'Failed to list shared views');
    }
  }
);

savedViewsRouter.post(
  '/',
  requireApiAuth,
  async (req: AuthenticatedRequest, res) => {
    const validation = createSavedViewSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: z.treeifyError(validation.error) });
    }

    try {
      const view = await savedViewsService.create(req.userId!, validation.data);
      res.status(201).json({ data: view });
    } catch (error) {
      sendError(res, error, 'Failed to create saved view');
    }
  }
);

savedViewsRouter.patch(
  '/:id',
  requireApiAuth,
  async (req: AuthenticatedRequest, res) => {
    const validation = updateSavedViewSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: z.treeifyError(validation.error) });
    }

    try {
      const view = await savedViewsService.update(
        req.userId!,
        req.params.id!,
        validation.data
      );
      res.json({ data: view });
    } catch (error) {
      sendError(res, error, 'Failed to update saved view');
    }
  }
);

savedViewsRouter.post(
  '/:id/archive',
  requireApiAuth,
  postOwnedViewStatusAction('archive', 'Failed to archive saved view')
);

savedViewsRouter.post(
  '/:id/restore',
  requireApiAuth,
  postOwnedViewStatusAction('restore', 'Failed to restore saved view')
);

savedViewsRouter.delete(
  '/:id/share',
  requireApiAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      await savedViewsService.deleteShare(req.userId!, req.params.id!);
      res.json({ success: true });
    } catch (error) {
      sendError(res, error, 'Failed to remove shared view');
    }
  }
);

savedViewsRouter.delete(
  '/:id',
  requireApiAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      await savedViewsService.hardDelete(req.userId!, req.params.id!);
      res.json({ success: true });
    } catch (error) {
      sendError(res, error, 'Failed to delete saved view');
    }
  }
);

savedViewsRouter.post(
  '/:id/share',
  requireApiAuth,
  async (req: AuthenticatedRequest, res) => {
    const validation = shareSavedViewSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: z.treeifyError(validation.error) });
    }

    try {
      const result = await savedViewsService.share(
        req.userId!,
        req.params.id!,
        validation.data
      );
      res.json({ data: result });
    } catch (error) {
      sendError(res, error, 'Failed to share saved view');
    }
  }
);

export default savedViewsRouter;
