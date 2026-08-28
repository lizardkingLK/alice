import express, { Router } from 'express';
import { z } from 'zod';
import { createWorkLogSchema, listWorkLogsQuerySchema } from '@repo/types';
import {
  requireApiAuth,
  type AuthenticatedRequest,
} from '../../../middlewares/auth';
import {
  WorkItemAccessError,
  WorkItemValidationError,
} from '../workItems/workItems.errors';
import { WorklogsService } from './worklogs.service';

export type WorklogsRouterDeps = {
  worklogsService: WorklogsService;
};

function sendWorkLogMutationError(
  res: {
    status: (code: number) => {
      json: (body: Record<string, unknown>) => void;
    };
  },
  error: unknown,
  fallbackMessage: string
) {
  const message = error instanceof Error ? error.message : fallbackMessage;

  if (error instanceof WorkItemAccessError) {
    return res.status(403).json({ error: message });
  }

  if (error instanceof WorkItemValidationError) {
    return res.status(400).json({ error: message });
  }

  if (/work item not found/i.test(message)) {
    return res.status(404).json({ error: message });
  }

  return res.status(500).json({ error: message });
}

export function createWorklogsRouter(deps: WorklogsRouterDeps): Router {
  const { worklogsService } = deps;
  const worklogsRouter: Router = express.Router();

  /**
   * Unused Express list path (Prisma). Next still lists via RSC supabase-js.
   */
  worklogsRouter.get(
    '/',
    requireApiAuth,
    async (req: AuthenticatedRequest, res) => {
      const parsed = listWorkLogsQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return res.status(400).json({ error: z.treeifyError(parsed.error) });
      }

      try {
        const rows = await worklogsService.listByWorkItemId(
          parsed.data.work_item_id,
          req.userId!
        );
        return res.json(rows);
      } catch (error) {
        return sendWorkLogMutationError(res, error, 'Failed to list work logs');
      }
    }
  );

  worklogsRouter.post(
    '/',
    requireApiAuth,
    async (req: AuthenticatedRequest, res) => {
      const parsed = createWorkLogSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: z.treeifyError(parsed.error) });
      }

      const dateOnly =
        parsed.data.logged_at ?? new Date().toISOString().slice(0, 10);
      const loggedAtIso = new Date(`${dateOnly}T00:00:00.000Z`).toISOString();

      try {
        const worklog = await worklogsService.createWorkLog(req.userId!, {
          workItemId: parsed.data.work_item_id,
          loggedHours: parsed.data.logged_hours,
          loggedAtIso,
          comment: parsed.data.comment ?? null,
        });

        return res.status(201).json({ worklog });
      } catch (error) {
        return sendWorkLogMutationError(
          res,
          error,
          'Failed to create work log'
        );
      }
    }
  );

  return worklogsRouter;
}
