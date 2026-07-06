import { Router } from 'express';
import { z } from 'zod';
import {
  requireApiAuth,
  type AuthenticatedRequest,
} from '../../../middlewares/auth';
import {
  createSprintBodySchema,
  updateSprintStatusSchema,
  updateSprintBodySchema,
} from './sprints.schemas';
import { sprintsService } from './sprints.service';

const sprintsRouter: Router = Router();

sprintsRouter.get(
  '/',
  requireApiAuth,
  async (req: AuthenticatedRequest, res) => {
    try {
      const sprints = await sprintsService.listSprints(req.userId!);
      res.json({ sprints });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to list sprints';
      res.status(500).json({ error: message });
    }
  }
);

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

const statusUpdateMap: Record<
  'Not Started' | 'Ongoing' | 'Completed' | 'Archived',
  'planned' | 'active' | 'closed'
> = {
  'Not Started': 'planned',
  Ongoing: 'active',
  Completed: 'closed',
  Archived: 'closed',
};

sprintsRouter.patch(
  '/:id/status',
  requireApiAuth,
  async (req: AuthenticatedRequest, res) => {
    const parsed = updateSprintStatusSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ error: z.treeifyError(parsed.error) });
    }

    const serviceStatus = statusUpdateMap[parsed.data.status];

    try {
      const sprint = await sprintsService.updateSprintStatus(
        req.userId!,
        req.params.id!,
        serviceStatus
      );
      res.json({ sprint });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to update sprint status';
      res.status(500).json({ error: message });
    }
  }
);

sprintsRouter.get(
  '/:id',
  requireApiAuth,
  async (req: AuthenticatedRequest, res) => {
    try {
      const sprint = await sprintsService.getSprint(req.userId!, req.params.id!);
      if (!sprint) {
        return res.status(404).json({ error: 'Sprint not found' });
      }
      res.json({ sprint });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to get sprint';
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
      const message =
        error instanceof Error ? error.message : 'Failed to update sprint';
      res.status(500).json({ error: message });
    }
  }
);

export default sprintsRouter;
