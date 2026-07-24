import { Router } from 'express';
import { z } from 'zod';
import {
  requireApiAuth,
  type AuthenticatedRequest,
} from '../../../middlewares/auth';
import { parsePagination } from '../../../lib/pagination';
import { workItemService } from './workItems.service';
import { notificationsService } from '../notifications/notifications.service';
import {
  createUpdateWorkItemBodySchema,
  patchUpdateWorkItemBodySchema,
  SupabaseJson,
} from './workItems.schemas';
import type { DbWorkItem } from './workItems.repository';

type PatchUpdateWorkItemPayload = z.infer<typeof patchUpdateWorkItemBodySchema>;

function parsePatchBody(body: Record<string, unknown>) {
  const processedBody = { ...body };

  if (typeof body.description === 'string') {
    try {
      processedBody.description = JSON.parse(body.description);
    } catch {
      return null;
    }
  }

  return processedBody;
}

function buildWorkItemPayload(
  parsedData: PatchUpdateWorkItemPayload,
  existingWorkItem: DbWorkItem
) {
  return {
    title: parsedData.title ?? existingWorkItem.title,
    project_id: parsedData.project_id ?? existingWorkItem.project_id,
    type: parsedData.type ?? existingWorkItem.type,
    assignee_id:
      parsedData.assignee_id !== undefined
        ? parsedData.assignee_id
        : existingWorkItem.assignee_id,
    due_date:
      parsedData.due_date !== undefined
        ? parsedData.due_date
        : existingWorkItem.due_date,
    description: (parsedData.description !== undefined
      ? parsedData.description
      : existingWorkItem.description) as SupabaseJson,
    status: parsedData.status ?? existingWorkItem.status,
    sprint_id:
      parsedData.sprint_id !== undefined
        ? parsedData.sprint_id
        : existingWorkItem.sprint_id,
    story_points:
      parsedData.story_points !== undefined
        ? parsedData.story_points
        : existingWorkItem.story_points,
  };
}

function shouldNotifyAssigneeChange(
  existingWorkItem: DbWorkItem,
  workItem: DbWorkItem | null,
  actorId?: string
) {
  return Boolean(
    workItem?.assignee_id &&
    workItem.assignee_id !== existingWorkItem.assignee_id &&
    workItem.assignee_id !== actorId
  );
}

function createAssignNotification(workItem: DbWorkItem, actorId: string) {
  notificationsService
    .createAssignNotification({
      assigneeId: workItem.assignee_id!,
      actorId,
      taskTitle: workItem.title,
      taskId: workItem.id,
    })
    .catch((err) =>
      console.error('Failed to trigger assign notification on update:', err)
    );
}

const workItemsRouter: Router = Router();

workItemsRouter.get(
  '/',
  requireApiAuth,
  async (req: AuthenticatedRequest, res) => {
    try {
      const searchQuery =
        typeof req.query.search === 'string' ? req.query.search : undefined;
      const pagination = parsePagination(req);

      // Parse filters
      let sprint_id: string | null | undefined = undefined;
      if (req.query.sprint_id === 'null' || req.query.backlog === 'true') {
        sprint_id = null;
      } else if (typeof req.query.sprint_id === 'string') {
        sprint_id = req.query.sprint_id;
      }
      const filters = { sprint_id };

      if (pagination) {
        const { page, limit } = pagination;
        const result = (await workItemService.listWorkItems(
          page,
          limit,
          searchQuery,
          filters
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

      const workItems = await workItemService.getWorkItems(filters);
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

      if (workItem?.assignee_id && workItem.assignee_id !== req.userId) {
        notificationsService
          .createAssignNotification({
            assigneeId: workItem.assignee_id,
            actorId: req.userId!,
            taskTitle: workItem.title,
            taskId: workItem.id,
          })
          .catch((err) =>
            console.error('Failed to trigger assign notification:', err)
          );
      }

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
      const processedBody = parsePatchBody(req.body as Record<string, unknown>);
      if (!processedBody) {
        return res.status(400).json({
          data: null,
          error: 'Invalid JSON format provided for description field',
        });
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

      const payload = buildWorkItemPayload(parsed.data, existingWorkItem);
      const workItem = await workItemService.updateWorkItem(
        req.userId!,
        req.params.id!,
        payload
      );

      if (
        workItem &&
        shouldNotifyAssigneeChange(existingWorkItem, workItem, req.userId)
      ) {
        createAssignNotification(workItem, req.userId!);
      }

      res.status(200).json({ data: workItem, error: null });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to update work-item';
      res.status(500).json({ data: null, error: message });
    }
  }
);

export default workItemsRouter;
