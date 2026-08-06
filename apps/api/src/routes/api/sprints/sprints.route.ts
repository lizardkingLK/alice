import { Router } from 'express';
import { z } from 'zod';
import {
  requireApiAuth,
  type AuthenticatedRequest,
} from '../../../middlewares/auth';
import { trySendOptimisticLockError } from '../../../lib/optimistic-lock';
import {
  createSprintBodySchema,
  updateSprintStatusSchema,
  updateSprintBodySchema,
} from './sprints.schemas';
import type { SprintsService, SprintBurndownService } from './sprints.service';

export type SprintsRouterDeps = {
  sprintsService: SprintsService;
  sprintBurndownService: SprintBurndownService;
};

export function createSprintsRouter(deps: SprintsRouterDeps): Router {
  const { sprintsService, sprintBurndownService } = deps;

  const sprintsRouter: Router = Router();

  sprintsRouter.post(
    '/',
    requireApiAuth,
    async (req: AuthenticatedRequest, res) => {
      const parsed = createSprintBodySchema.safeParse(req.body);

      if (!parsed.success) {
        return res.status(400).json({ error: z.treeifyError(parsed.error) });
      }

      try {
        const sprint = await sprintsService.createSprint(
          req.userId!,
          parsed.data
        );
        res.status(201).json({ sprint });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Failed to create sprint';
        res.status(500).json({ error: message });
      }
    }
  );
  sprintsRouter.patch(
    '/:id/status',
    requireApiAuth,
    async (req: AuthenticatedRequest, res) => {
      const parsed = updateSprintStatusSchema.safeParse(req.body);

      if (!parsed.success) {
        return res.status(400).json({ error: z.treeifyError(parsed.error) });
      }

      try {
        const sprint = await sprintsService.updateSprintStatus(
          req.userId!,
          req.params.id!,
          parsed.data.status,
          parsed.data.expectedUpdatedAt
        );
        res.json({ sprint });
      } catch (error) {
        if (trySendOptimisticLockError(res, error)) return;
        const message =
          error instanceof Error
            ? error.message
            : 'Failed to update sprint status';
        res.status(500).json({ error: message });
      }
    }
  );

  sprintsRouter.patch(
    '/:id',
    requireApiAuth,
    async (req: AuthenticatedRequest, res) => {
      const parsed = updateSprintBodySchema.safeParse(req.body);

      if (!parsed.success) {
        return res.status(400).json({ error: z.treeifyError(parsed.error) });
      }

      try {
        const sprint = await sprintsService.updateSprint(
          req.userId!,
          req.params.id!,
          parsed.data
        );
        res.json({ sprint });
      } catch (error) {
        if (trySendOptimisticLockError(res, error)) return;
        const message =
          error instanceof Error ? error.message : 'Failed to update sprint';
        res.status(500).json({ error: message });
      }
    }
  );

  sprintsRouter.get(
    '/:id/burndown',
    requireApiAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const burndown = await sprintBurndownService.getBurndown(req.params.id!);
        if (!burndown) {
          return res.status(404).json({ error: 'Sprint not found' });
        }
        res.json(burndown);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Failed to fetch burndown data';
        res.status(500).json({ error: message });
      }
    }
  );

  return sprintsRouter;
}
