import { Router, type Response } from 'express';
import { z, type ZodType } from 'zod';
import {
  chartDrilldownQuerySchema,
  chartHierarchyDrilldownQuerySchema,
  chartHierarchySeriesQuerySchema,
  chartSeriesQuerySchema,
} from '@repo/types';
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
    message === 'Only active charts can be shared' ||
    message === 'State series requires a single project filter' ||
    message === 'Cannot fork your own chart'
  ) {
    status = 400;
  }
  res.status(status).json({ error: message });
}

function registerChartAnalyticsGet<T>(
  router: Router,
  path: string,
  schema: ZodType<T>,
  load: (userId: string, query: T) => Promise<unknown>,
  fallbackMessage: string
): void {
  router.get(path, requireApiAuth, async (req: AuthenticatedRequest, res) => {
    const validation = schema.safeParse(req.query);
    if (!validation.success) {
      return res.status(400).json({ error: z.treeifyError(validation.error) });
    }
    try {
      const data = await load(req.userId!, validation.data);
      res.json({ data });
    } catch (error) {
      sendError(res, error, fallbackMessage);
    }
  });
}

export function createChartsRouter(deps: ChartsRouterDeps) {
  const { chartsService } = deps;
  const chartsRouter: Router = Router();

  chartsRouter.get(
    '/',
    requireApiAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        let scope: 'owned' | 'shared' | 'dashboard' = 'owned';
        if (req.query.scope === 'shared') {
          scope = 'shared';
        } else if (req.query.scope === 'dashboard') {
          scope = 'dashboard';
        }
        let status: 'active' | 'archived' | undefined;
        if (req.query.status === 'archived') {
          status = 'archived';
        } else if (req.query.status === 'active') {
          status = 'active';
        }
        let data;
        if (scope === 'shared') {
          data = await chartsService.listSharedWithMe(req.userId!);
        } else if (scope === 'dashboard') {
          data = await chartsService.listDashboardSlides(req.userId!);
        } else {
          data = await chartsService.listOwned(req.userId!, status);
        }
        res.json({ data });
      } catch (error) {
        sendError(res, error, 'Failed to list charts');
      }
    }
  );

  // Static analytics paths must be registered before `/:id`.
  registerChartAnalyticsGet(
    chartsRouter,
    '/analytics/series',
    chartSeriesQuerySchema,
    (userId, query) => chartsService.getSeries(userId, query),
    'Failed to load chart series'
  );
  registerChartAnalyticsGet(
    chartsRouter,
    '/analytics/drilldown',
    chartDrilldownQuerySchema,
    (userId, query) => chartsService.getDrilldown(userId, query),
    'Failed to load chart drilldown'
  );
  registerChartAnalyticsGet(
    chartsRouter,
    '/analytics/hierarchy-series',
    chartHierarchySeriesQuerySchema,
    (userId, query) => chartsService.getHierarchySeries(userId, query),
    'Failed to load hierarchy chart series'
  );
  registerChartAnalyticsGet(
    chartsRouter,
    '/analytics/hierarchy-drilldown',
    chartHierarchyDrilldownQuerySchema,
    (userId, query) => chartsService.getHierarchyDrilldown(userId, query),
    'Failed to load hierarchy chart drilldown'
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
        res.json({ success: true });
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
        res.json({ success: true });
      } catch (error) {
        sendError(res, error, 'Failed to leave shared chart');
      }
    }
  );

  chartsRouter.post(
    '/:id/fork',
    requireApiAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const chart = await chartsService.fork(req.userId!, req.params.id!);
        res.status(201).json({ data: chart });
      } catch (error) {
        sendError(res, error, 'Failed to fork chart');
      }
    }
  );

  return chartsRouter;
}
