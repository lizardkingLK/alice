import { Router } from 'express';
import { z } from 'zod';
import {
  requireApiAuth,
  type AuthenticatedRequest,
} from '../../../middlewares/auth';
import { trySendOptimisticLockError } from '../../../lib/optimistic-lock';
import {
  WorkItemAccessError,
  WorkItemValidationError,
} from './workItems.errors';
import { type WorkItemService } from './workItems.service';
import type { NotificationsService } from '../notifications/notifications.service';
import {
  createWorkItemBodySchema,
  isBlockedPastDueDateChange,
  linkWorkItemGithubPrBodySchema,
  patchWorkItemBodySchema,
  preprocessWorkItemMutationBody,
  workItemLifecycleActionBodySchema,
  type WorkItemUpdateBody,
} from './workItems.schemas';
import type { DbWorkItem } from './workItems.repository';
import { coalescePatchField } from './workItems.patch-utils';
import { listWorkItemsQuerySchema, parseWorkItemLabels } from '@repo/types';

type PatchUpdateWorkItemPayload = z.infer<typeof patchWorkItemBodySchema>;

export type WorkItemsRouterDeps = {
  workItemService: WorkItemService;
  notificationsService: Pick<NotificationsService, 'createAssignNotification'>;
};

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

function shouldNotifyNewAssignee(
  workItem: DbWorkItem | null | undefined,
  actorId?: string
) {
  return Boolean(workItem?.assignee_id && workItem.assignee_id !== actorId);
}

export function shouldNotifyAssigneeChange(
  existingWorkItem: DbWorkItem,
  workItem: DbWorkItem | null,
  actorId?: string
) {
  if (!workItem || !shouldNotifyNewAssignee(workItem, actorId)) {
    return false;
  }
  return workItem.assignee_id !== existingWorkItem.assignee_id;
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
  if (error instanceof WorkItemAccessError) {
    return res.status(403).json({ data: null, error: message });
  }
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
    recordStatus: firstQueryValue(query.recordStatus),
  });
}

type WorkItemLockAction = (
  actorId: string,
  workItemId: string,
  expectedUpdatedAt: string
) => Promise<DbWorkItem>;

/** PATCH handlers that require `expectedUpdatedAt` and return `{ workItem }`. */
function createWorkItemLockActionHandler(
  action: WorkItemLockAction,
  failureFallback: string
) {
  return async (
    req: AuthenticatedRequest,
    res: {
      status: (code: number) => {
        json: (body: Record<string, unknown>) => void;
      };
      json: (body: Record<string, unknown>) => void;
    }
  ) => {
    const parsed = workItemLifecycleActionBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: z.treeifyError(parsed.error) });
    }
    try {
      const workItem = await action(
        req.userId!,
        req.params.id!,
        parsed.data.expectedUpdatedAt
      );
      res.json({ workItem });
    } catch (error) {
      sendWorkItemMutationError(res, error, failureFallback);
    }
  };
}

export function createWorkItemsRouter(deps: WorkItemsRouterDeps): Router {
  const { workItemService, notificationsService } = deps;

  function createAssignNotification(workItem: DbWorkItem, actorId: string) {
    return notificationsService.createAssignNotification({
      assigneeId: workItem.assignee_id!,
      actorId,
      taskTitle: workItem.title,
      taskId: workItem.id,
    });
  }

  /**
   * Await the Prisma insert so Vercel does not freeze the isolate before
   * commit. Realtime postgres_changes reads WAL only after commit.
   */
  async function notifyAssigneeAfterCommit(
    workItem: DbWorkItem | null | undefined,
    actorId: string | undefined,
    shouldNotify: boolean
  ): Promise<void> {
    if (!workItem || !actorId || !shouldNotify) {
      return;
    }
    await createAssignNotification(workItem, actorId);
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
          parsed.data,
          req.userId!
        );
        res.json(result);
      } catch (error) {
        if (error instanceof WorkItemAccessError) {
          return res.status(403).json({ error: error.message });
        }
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
      const parsed = linkWorkItemGithubPrBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ data: null, error: z.treeifyError(parsed.error) });
      }

      try {
        const linked = await workItemService.linkPR(
          req.userId!,
          req.params.id!,
          parsed.data.prUrl
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
        const workItem = await workItemService.getWorkItemDetail(
          parsedId.data,
          req.userId!
        );
        if (!workItem) {
          return res
            .status(404)
            .json({ data: null, error: 'Work item not found' });
        }
        res.json({ data: workItem, error: null });
      } catch (error) {
        if (error instanceof WorkItemAccessError) {
          return res.status(403).json({ data: null, error: error.message });
        }
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
      const parsed = createWorkItemBodySchema.safeParse(req.body);

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

        await notifyAssigneeAfterCommit(
          workItem,
          req.userId,
          shouldNotifyNewAssignee(workItem, req.userId)
        );

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
        const processedBody = preprocessWorkItemMutationBody(
          req.body as Record<string, unknown>
        );
        if (!processedBody) {
          return res.status(400).json({
            data: null,
            error: 'Invalid JSON format provided for description field',
          });
        }

        const parsed = patchWorkItemBodySchema.safeParse(processedBody);
        if (!parsed.success) {
          return res
            .status(400)
            .json({ data: null, error: z.treeifyError(parsed.error) });
        }

        const existingWorkItem = await workItemService.getWorkItem(
          req.params.id!,
          req.userId!
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

        await notifyAssigneeAfterCommit(
          workItem,
          req.userId,
          shouldNotifyAssigneeChange(existingWorkItem, workItem, req.userId)
        );

        res.status(200).json({ data: workItem, error: null });
      } catch (error) {
        sendWorkItemMutationError(res, error, 'Failed to update work-item');
      }
    }
  );

  workItemsRouter.get(
    '/:id/descendant-count',
    requireApiAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const descendantCount = await workItemService.countDescendants(
          req.params.id!,
          req.userId!
        );
        res.json({ descendantCount });
      } catch (error) {
        sendWorkItemMutationError(
          res,
          error,
          'Failed to count work item descendants'
        );
      }
    }
  );

  workItemsRouter.patch(
    '/:id/archive',
    requireApiAuth,
    createWorkItemLockActionHandler(
      (actorId, workItemId, expectedUpdatedAt) =>
        workItemService.archiveWorkItem(actorId, workItemId, expectedUpdatedAt),
      'Failed to archive work item'
    )
  );

  workItemsRouter.patch(
    '/:id/restore',
    requireApiAuth,
    createWorkItemLockActionHandler(
      (actorId, workItemId, expectedUpdatedAt) =>
        workItemService.restoreWorkItem(actorId, workItemId, expectedUpdatedAt),
      'Failed to restore work item'
    )
  );

  workItemsRouter.delete(
    '/:id',
    requireApiAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const result = await workItemService.purgeWorkItem(
          req.userId!,
          req.params.id!
        );
        res.json({ success: true, ...result });
      } catch (error) {
        sendWorkItemMutationError(res, error, 'Failed to delete work item');
      }
    }
  );

  return workItemsRouter;
}
