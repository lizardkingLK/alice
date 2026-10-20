import { Router } from 'express';
import { generateReportRequestSchema } from '@repo/types';
import { z } from 'zod';
import {
  requireApiAuth,
  type AuthenticatedRequest,
} from '../../../middlewares/auth';
import { ReportAccessError, type ReportsService } from './reports.service';
import { ReportTimezoneError } from './reports.timezone';

export type ReportsRouterDeps = {
  reportsService: ReportsService;
};

export function createReportsRouter(deps: ReportsRouterDeps): Router {
  const router = Router();

  router.post(
    '/generate',
    requireApiAuth,
    async (req: AuthenticatedRequest, res) => {
      const validation = generateReportRequestSchema.safeParse(req.body);
      if (!validation.success) {
        return res
          .status(400)
          .json({ error: z.treeifyError(validation.error) });
      }

      try {
        const report = await deps.reportsService.generate(
          req.userId!,
          validation.data
        );
        res.json({ data: report });
      } catch (error) {
        if (error instanceof ReportAccessError) {
          return res.status(403).json({ error: error.message });
        }
        if (error instanceof ReportTimezoneError) {
          return res.status(400).json({ error: error.message });
        }
        const message =
          error instanceof Error ? error.message : 'Failed to generate report';
        res.status(500).json({ error: message });
      }
    }
  );

  return router;
}
