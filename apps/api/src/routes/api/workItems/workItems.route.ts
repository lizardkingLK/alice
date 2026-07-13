import { Router } from 'express';
import { z } from 'zod';
import {
  requireApiAuth,
  type AuthenticatedRequest,
} from '../../../middlewares/auth';
import { workItemService } from './workItems.service';
import { createUpdateWorkItemBodySchema } from './workItems.schemas';

const workItemsRouter: Router = Router();

workItemsRouter.get(
  '/',
  requireApiAuth,
  async (_req: AuthenticatedRequest, res) => {
    try {
      const workItems = await workItemService.listWorkItems();
      res.json(workItems);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to list work-items';
      res.status(500).json({ error: message });
    }
  }
);

workItemsRouter.post(
  '/',
  requireApiAuth,
  async (req: AuthenticatedRequest, res) => {
    const parsed = createUpdateWorkItemBodySchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ error: z.treeifyError(parsed.error) });
    }

    try {
      const workItem = await workItemService.createWorkItem(
        req.userId!,
        parsed.data
      );
      res.status(201).json({ data: workItem, error: null });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to create work-item';
      res.status(500).json({ data: null, error: message });
    }
  }
);

workItemsRouter.patch(
  '/:id',
  requireApiAuth,
  async (req: AuthenticatedRequest, res) => {
    try {
      const parsed = createUpdateWorkItemBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: z.treeifyError(parsed.error) });
      }

      const workItem = await workItemService.updateWorkItem(
        req.userId!,
        req.params.id!,
        parsed.data
      );
      res.status(200).json({ data: workItem, error: null });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to update work-item';
      res.status(500).json({ data: null, error: message });
    }
  }
);

export default workItemsRouter;
