import { Router } from 'express';
import { z } from 'zod';
import {
  requireApiAuth,
  type AuthenticatedRequest,
} from '../../../middlewares/auth';
import { parsePagination } from '../../../lib/pagination';
import { workItemService } from './workItems.service';
import {
  createUpdateWorkItemBodySchema,
  patchUpdateWorkItemBodySchema,
  SupabaseJson,
} from './workItems.schemas';
import type { DbWorkItem } from './workItems.repository';

const workItemsRouter: Router = Router();

workItemsRouter.get(
  '/',
  requireApiAuth,
  async (req: AuthenticatedRequest, res) => {
    try {
      const searchQuery =
        typeof req.query.search === 'string' ? req.query.search : undefined;
      const pagination = parsePagination(req);

      if (pagination) {
        const { page, limit } = pagination;
        const result = (await workItemService.listWorkItems(
          page,
          limit,
          searchQuery
        )) as { workItems: DbWorkItem[]; totalCount: number };
        const totalPages = Math.max(1, Math.ceil(result.totalCount / limit));

        return res.json({
          workItems: result.workItems,
          totalCount: result.totalCount,
          page,
          limit,
          totalPages,
        });
      }

      const workItems = await workItemService.getWorkItems();
      res.json({ data: workItems, error: null });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to list work-items';
      res.status(500).json({ error: message });
    }
  }
);

workItemsRouter.get(
  '/:id',
  requireApiAuth,
  async (req: AuthenticatedRequest, res) => {
    try {
      const workItem = await workItemService.getWorkItem(req.params.id!);
      if (!workItem) {
        return res
          .status(404)
          .json({ data: null, error: 'Work-Item not found' });
      }

      res.json({ data: workItem, error: null });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to get work-item';
      res.status(500).json({ data: null, error: message });
    }
  }
);

workItemsRouter.post(
  '/',
  requireApiAuth,
  async (req: AuthenticatedRequest, res) => {
    const parsed = createUpdateWorkItemBodySchema.safeParse(req.body);

    if (!parsed.success) {
      return res
        .status(400)
        .json({ data: null, error: z.treeifyError(parsed.error) });
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
      const processedBody = { ...req.body };

      if (typeof req.body.description === 'string') {
        try {
          processedBody.description = JSON.parse(req.body.description);
        } catch {
          return res.status(400).json({
            data: null,
            error: 'Invalid JSON format provided for description field',
          });
        }
      }

      const parsed = patchUpdateWorkItemBodySchema.safeParse(processedBody);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ data: null, error: z.treeifyError(parsed.error) });
      }

      const existingWorkItem = await workItemService.getWorkItem(
        req.params.id!
      );
      if (!existingWorkItem) {
        return res
          .status(404)
          .json({ data: null, error: 'Work item not found' });
      }

      const payload = {
        title: parsed.data.title ?? existingWorkItem.title,
        project_id: parsed.data.project_id ?? existingWorkItem.project_id,
        type: parsed.data.type ?? existingWorkItem.type,
        assignee_id:
          parsed.data.assignee_id !== undefined
            ? parsed.data.assignee_id
            : existingWorkItem.assignee_id,
        due_date:
          parsed.data.due_date !== undefined
            ? parsed.data.due_date
            : existingWorkItem.due_date,
        description: (parsed.data.description !== undefined
          ? parsed.data.description
          : existingWorkItem.description) as SupabaseJson,
        status: parsed.data.status ?? existingWorkItem.status,
      };

      const workItem = await workItemService.updateWorkItem(
        req.userId!,
        req.params.id!,
        payload
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
