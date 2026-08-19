import { Router } from 'express';
import { z } from 'zod';
import {
  requireApiAuth,
  type AuthenticatedRequest,
} from '../../../middlewares/auth';
import { trySendOptimisticLockError } from '../../../lib/optimistic-lock';
import { WorkItemValidationError } from './workItems.errors';
import { type WorkItemService } from './workItems.service';
import type { NotificationsService } from '../notifications/notifications.service';
import {
  createUpdateWorkItemBodySchema,
  createWorkLogSchema,
  isBlockedPastDueDateChange,
  patchUpdateWorkItemBodySchema,
  type WorkItemUpdateBody,
} from './workItems.schemas';
import type { DbWorkItem } from './workItems.repository';
import { coalescePatchField } from './workItems.patch-utils';
import {
  coerceLabelsFormField,
  listWorkItemsQuerySchema,
  parseWorkItemLabels,
} from '@repo/types';

type PatchUpdateWorkItemPayload = z.infer<typeof patchUpdateWorkItemBodySchema>;

export type WorkItemsRouterDeps = {
  workItemService: WorkItemService;
  notificationsService: Pick<NotificationsService, 'createAssignNotification'>;
};

function parsePatchBody(body: Record<string, unknown>) {
  const processedBody = { ...body };

  if (typeof body.description === 'string') {
    try {
      processedBody.description = JSON.parse(body.description);
    } catch {
      return null;
    }
  }

  if ('labels' in body) {
    processedBody.labels = coerceLabelsFormField(body.labels);
  }

  return processedBody;
}

function buildWorkItemPayload(
  parsedData: PatchUpdateWorkItemPayload,
  existingWorkItem: DbWorkItem
) {
  return {
    title: coalescePatchField(parsedData.title, existingWorkItem.title),
    project_id: coalescePatchField(
      parsedData.project_id,
      existingWorkItem.project_id
    ),
    type: coalescePatchField(parsedData.type, existingWorkItem.type),
    priority: coalescePatchField(
      parsedData.priority,
      existingWorkItem.priority
    ),
    assignee_id: coalescePatchField(
      parsedData.assignee_id,
      existingWorkItem.assignee_id
    ),
    reporter_id: coalescePatchField(
      parsedData.reporter_id,
      existingWorkItem.reporter_id
    ),
    due_date: coalescePatchField(
      parsedData.due_date,
      existingWorkItem.due_date
    ),
    status: coalescePatchField(parsedData.status, existingWorkItem.status),
    sprint_id: coalescePatchField(
      parsedData.sprint_id,
      existingWorkItem.sprint_id
    ),
    story_points: coalescePatchField(
      parsedData.story_points,
      existingWorkItem.story_points
    ),
    parent_id: coalescePatchField(
      parsedData.parent_id,
      existingWorkItem.parent_id
    ),
    description: coalescePatchField(
      parsedData.description as WorkItemUpdateBody['description'] | undefined,
      existingWorkItem.description as WorkItemUpdateBody['description']
    ),
    labels: coalescePatchField(
      parsedData.labels,
      parseWorkItemLabels(existingWorkItem.labels)
    ),
    jira_issue_key: coalescePatchField(
      parsedData.jira_issue_key,
      existingWorkItem.jira_issue_key
    ),
    expectedUpdatedAt: parsedData.expectedUpdatedAt,
  };
}

export function shouldNotifyAssigneeChange(
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

function sendWorkItemMutationError(
  res: {
    status: (code: number) => {
      json: (body: Record<string, unknown>) => void;
    };
  },
  error: unknown,
  fallbackMessage: string
) {
  if (trySendOptimisticLockError(res, error)) {
    return;
  }

  const message = error instanceof Error ? error.message : fallbackMessage;
  if (error instanceof WorkItemValidationError) {
    return res.status(400).json({ data: null, error: message });
  }
  return res.status(500).json({ data: null, error: message });
}

function firstQueryValue(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value) && typeof value[0] === 'string') {
    return value[0];
  }
  return undefined;
}

function listWorkItemsQueryFromRequest(query: Record<string, unknown>) {
  return listWorkItemsQuerySchema.safeParse({
    page: firstQueryValue(query.page),
    limit: firstQueryValue(query.limit),
    search: firstQueryValue(query.search),
    projectId: firstQueryValue(query.projectId),
    sprintId: firstQueryValue(query.sprintId),
    parentId: firstQueryValue(query.parentId),
    type: firstQueryValue(query.type),
    assigneeId: firstQueryValue(query.assigneeId),
    labels: firstQueryValue(query.labels),
    view: firstQueryValue(query.view),
    includeDescription: firstQueryValue(query.includeDescription),
  });
}

export function createWorkItemsRouter(deps: WorkItemsRouterDeps): Router {
  const { workItemService, notificationsService } = deps;

  function createAssignNotification(workItem: DbWorkItem, actorId: string) {
    notificationsService
      .createAssignNotification({
        assigneeId: workItem.assignee_id!,
        actorId,
        taskTitle: workItem.title,
        taskId: workItem.id,
      })
      .catch((err) =>
        console.error('Failed to trigger assign notification:', err)
      );
  }

  const workItemsRouter: Router = Router();

  workItemsRouter.get(
    '/',
    requireApiAuth,
    async (req: AuthenticatedRequest, res) => {
      const parsed = listWorkItemsQueryFromRequest(
        req.query as Record<string, unknown>
      );
      if (!parsed.success) {
        return res.status(400).json({ error: z.treeifyError(parsed.error) });
      }

      try {
        const result = await workItemService.listWorkItemsPaginated(
          parsed.data
        );
        res.json(result);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Failed to list work-items';
        res.status(500).json({ error: message });
      }
    }
  );

  workItemsRouter.get(
    '/:id/github',
    requireApiAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const result = await workItemService.listLinkedPRs(
          req.userId!,
          req.params.id!
        );
        res.json(result);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Failed to get GitHub PRs';
        res.status(500).json({ error: message });
      }
    }
  );

  workItemsRouter.post(
    '/:id/github',
    requireApiAuth,
    async (req: AuthenticatedRequest, res) => {
      const { prUrl } = req.body;
      if (typeof prUrl !== 'string' || !prUrl.trim()) {
        return res
          .status(400)
          .json({ error: 'prUrl is required and must be a string' });
      }

      try {
        const linked = await workItemService.linkPR(
          req.userId!,
          req.params.id!,
          prUrl.trim()
        );
        res.status(201).json({ data: linked, error: null });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Failed to link GitHub PR';
        if (error instanceof WorkItemValidationError) {
          return res.status(400).json({ data: null, error: message });
        }
        res.status(500).json({ data: null, error: message });
      }
    }
  );

  workItemsRouter.delete(
    '/:id/github/:prId',
    requireApiAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        await workItemService.unlinkPR(
          req.userId!,
          req.params.id!,
          req.params.prId!
        );
        res.json({ success: true });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Failed to unlink GitHub PR';
        res.status(500).json({ error: message });
      }
    }
  );

  workItemsRouter.get(
    '/:id',
    requireApiAuth,
    async (req: AuthenticatedRequest, res) => {
      const parsedId = z.uuid().safeParse(req.params.id);
      if (!parsedId.success) {
        return res
          .status(400)
          .json({ data: null, error: 'Invalid work item id' });
      }

      try {
        const workItem = await workItemService.getWorkItemDetail(parsedId.data);
        if (!workItem) {
          return res
            .status(404)
            .json({ data: null, error: 'Work item not found' });
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
    '/:id/worklogs',
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
        const worklog = await workItemService.createWorkItemWorkLog(
          req.userId!,
          req.params.id!,
          {
            loggedHours: parsed.data.logged_hours,
            loggedAtIso,
            comment: parsed.data.comment ?? null,
          }
        );

        res.status(201).json({ worklog });
      } catch (error) {
        return sendWorkItemMutationError(
          res,
          error,
          'Failed to create work log'
        );
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
          createAssignNotification(workItem, req.userId!);
        }

        res.status(201).json({ data: workItem, error: null });
      } catch (error) {
        sendWorkItemMutationError(res, error, 'Failed to create work-item');
      }
    }
  );

  workItemsRouter.patch(
    '/:id',
    requireApiAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const processedBody = parsePatchBody(
          req.body as Record<string, unknown>
        );
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

        if (
          isBlockedPastDueDateChange(
            parsed.data.due_date,
            existingWorkItem.due_date
          )
        ) {
          return res.status(400).json({
            data: null,
            error: 'Due date must be on or after today',
          });
        }

        const payload = buildWorkItemPayload(parsed.data, existingWorkItem);
        const { expectedUpdatedAt, ...domainFields } = payload;
        const workItem = await workItemService.updateWorkItem(
          req.userId!,
          req.params.id!,
          domainFields,
          expectedUpdatedAt
        );

        if (
          workItem &&
          shouldNotifyAssigneeChange(existingWorkItem, workItem, req.userId)
        ) {
          createAssignNotification(workItem, req.userId!);
        }

        res.status(200).json({ data: workItem, error: null });
      } catch (error) {
        sendWorkItemMutationError(res, error, 'Failed to update work-item');
      }
    }
  );

  return workItemsRouter;
}
