import { Router } from 'express';
import { z } from 'zod';
import { requireApiAuth, type AuthenticatedRequest } from '@/middlewares/auth';
import {
  createSprintBodySchema,
  updateSprintStatusSchema,
  updateSprintBodySchema,
} from '@/routes/api/sprints/sprints.schemas';
import { sprintsService } from '@/routes/api/sprints/sprints.service';

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

const statusUpdateMap: Record<
  'Not Started' | 'Ongoing' | 'Completed' | 'Archived',
  'planned' | 'active' | 'closed' | 'archived'
> = {
  'Not Started': 'planned',
  Ongoing: 'active',
  Completed: 'closed',
  Archived: 'archived',
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
