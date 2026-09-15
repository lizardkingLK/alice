import { Router, type Response } from 'express';
import { z } from 'zod';
import {
  requireApiAuth,
  type AuthenticatedRequest,
} from '../../../middlewares/auth';
import {
  createChartSchema,
  shareChartSchema,
  updateChartSchema,
} from './charts.schemas';
import { ChartsService } from './charts.service';

export type ChartsRouterDeps = {
  chartsService: ChartsService;
};

function sendError(res: Response, error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  let status = 500;
  if (message === 'Forbidden') {
    status = 403;
  } else if (message === 'Chart not found') {
    status = 404;
  } else if (
    message === 'Only archived charts can be permanently deleted' ||
    message === 'Only active charts can be shared'
  ) {
    status = 400;
  }
  res.status(status).json({ error: message });
}

export function createChartsRouter(deps: ChartsRouterDeps) {
  const { chartsService } = deps;
  const chartsRouter: Router = Router();

  chartsRouter.get(
    '/',
    requireApiAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const scope = req.query.scope === 'shared' ? 'shared' : 'owned';
        let status: 'active' | 'archived' | undefined;
        if (req.query.status === 'archived') {
          status = 'archived';
        } else if (req.query.status === 'active') {
          status = 'active';
        }
        const data =
          scope === 'shared'
            ? await chartsService.listSharedWithMe(req.userId!)
            : await chartsService.listOwned(req.userId!, status);
        res.json({ data });
      } catch (error) {
        sendError(res, error, 'Failed to list charts');
      }
    }
  );

  chartsRouter.get(
    '/:id',
    requireApiAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const chart = await chartsService.getAccessible(
          req.userId!,
          req.params.id!
        );
        res.json({ data: chart });
      } catch (error) {
        sendError(res, error, 'Failed to load chart');
      }
    }
  );

  chartsRouter.post(
    '/',
    requireApiAuth,
    async (req: AuthenticatedRequest, res) => {
      const validation = createChartSchema.safeParse(req.body);
      if (!validation.success) {
        return res
          .status(400)
          .json({ error: z.treeifyError(validation.error) });
      }
      try {
        const chart = await chartsService.create(req.userId!, validation.data);
        res.status(201).json({ data: chart });
      } catch (error) {
        sendError(res, error, 'Failed to create chart');
      }
    }
  );

  chartsRouter.patch(
    '/:id',
    requireApiAuth,
    async (req: AuthenticatedRequest, res) => {
      const validation = updateChartSchema.safeParse(req.body);
      if (!validation.success) {
        return res
          .status(400)
          .json({ error: z.treeifyError(validation.error) });
      }
      try {
        const chart = await chartsService.update(
          req.userId!,
          req.params.id!,
          validation.data
        );
        res.json({ data: chart });
      } catch (error) {
        sendError(res, error, 'Failed to update chart');
      }
    }
  );

  chartsRouter.post(
    '/:id/archive',
    requireApiAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const chart = await chartsService.archive(req.userId!, req.params.id!);
        res.json({ data: chart });
      } catch (error) {
        sendError(res, error, 'Failed to archive chart');
      }
    }
  );

  chartsRouter.post(
    '/:id/restore',
    requireApiAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const chart = await chartsService.restore(req.userId!, req.params.id!);
        res.json({ data: chart });
      } catch (error) {
        sendError(res, error, 'Failed to restore chart');
      }
    }
  );

  chartsRouter.delete(
    '/:id',
    requireApiAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        await chartsService.hardDelete(req.userId!, req.params.id!);
        res.status(204).send();
      } catch (error) {
        sendError(res, error, 'Failed to delete chart');
      }
    }
  );

  chartsRouter.post(
    '/:id/share',
    requireApiAuth,
    async (req: AuthenticatedRequest, res) => {
      const validation = shareChartSchema.safeParse(req.body);
      if (!validation.success) {
        return res
          .status(400)
          .json({ error: z.treeifyError(validation.error) });
      }
      try {
        const result = await chartsService.share(
          req.userId!,
          req.params.id!,
          validation.data
        );
        res.json({ data: result });
      } catch (error) {
        sendError(res, error, 'Failed to share chart');
      }
    }
  );

  chartsRouter.delete(
    '/:id/share',
    requireApiAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        await chartsService.deleteShare(req.userId!, req.params.id!);
        res.status(204).send();
      } catch (error) {
        sendError(res, error, 'Failed to leave shared chart');
      }
    }
  );

  return chartsRouter;
}
