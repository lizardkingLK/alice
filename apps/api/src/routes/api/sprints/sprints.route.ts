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
import {
  SprintEstimationCancelledError,
  SprintEstimationForbiddenError,
  SprintEstimationLimitError,
  SprintEstimationNotFoundError,
  SprintEstimationUnauthenticatedError,
} from './sprints.errors';
import type { SprintEstimationService } from './sprint-estimation.service';
import {
  SprintAccessError,
  isSprintNameConflictMessage,
} from './sprints.errors';
import {
  deleteSprintActionSchema,
  listSprintsQuerySchema,
  DeleteSprintWorkItemsActionEnum,
} from '@repo/types';

export type SprintsRouterDeps = {
  sprintsService: SprintsService;
  sprintBurndownService: SprintBurndownService;
  sprintEstimationService: SprintEstimationService;
};

function firstQueryValue(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value) && typeof value[0] === 'string') {
    return value[0];
  }
  return undefined;
}

function listSprintsQueryFromRequest(query: Record<string, unknown>) {
  return listSprintsQuerySchema.safeParse({
    page: firstQueryValue(query.page),
    limit: firstQueryValue(query.limit),
    search: firstQueryValue(query.search),
    projectId: firstQueryValue(query.projectId),
    tab: firstQueryValue(query.tab),
  });
}

function sendSprintMutationError(
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
  if (error instanceof SprintAccessError) {
    return res.status(403).json({ data: null, error: message });
  }
  if (isSprintNameConflictMessage(message)) {
    return res.status(409).json({ data: null, error: message });
  }
  return res.status(500).json({ data: null, error: message });
}

export function createSprintsRouter(deps: SprintsRouterDeps): Router {
  const { sprintsService, sprintBurndownService, sprintEstimationService } =
    deps;

  const sprintsRouter: Router = Router();

  sprintsRouter.post(
    '/',
    requireApiAuth,
    async (req: AuthenticatedRequest, res) => {
      const parsed = createSprintBodySchema.safeParse(req.body);

      if (!parsed.success) {
        return res
          .status(400)
          .json({ data: null, error: z.treeifyError(parsed.error) });
      }

      try {
        const sprint = await sprintsService.createSprint(
          req.userId!,
          parsed.data
        );
        res.status(201).json({ data: sprint, error: null });
      } catch (error) {
        sendSprintMutationError(res, error, 'Failed to create sprint');
      }
    }
  );
  sprintsRouter.patch(
    '/:id/status',
    requireApiAuth,
    async (req: AuthenticatedRequest, res) => {
      const parsed = updateSprintStatusSchema.safeParse(req.body);

      if (!parsed.success) {
        return res
          .status(400)
          .json({ data: null, error: z.treeifyError(parsed.error) });
      }

      try {
        const sprint = await sprintsService.updateSprintStatus(
          req.userId!,
          req.params.id!,
          parsed.data.status,
          parsed.data.expectedUpdatedAt
        );
        res.status(200).json({ data: sprint, error: null });
      } catch (error) {
        sendSprintMutationError(res, error, 'Failed to update sprint status');
      }
    }
  );

  sprintsRouter.patch(
    '/:id',
    requireApiAuth,
    async (req: AuthenticatedRequest, res) => {
      const parsed = updateSprintBodySchema.safeParse(req.body);

      if (!parsed.success) {
        return res
          .status(400)
          .json({ data: null, error: z.treeifyError(parsed.error) });
      }

      try {
        const sprint = await sprintsService.updateSprint(
          req.userId!,
          req.params.id!,
          parsed.data
        );
        res.status(200).json({ data: sprint, error: null });
      } catch (error) {
        sendSprintMutationError(res, error, 'Failed to update sprint');
      }
    }
  );

  sprintsRouter.post(
    '/:id/estimates',
    requireApiAuth,
    async (req: AuthenticatedRequest, res) => {
      const parsedId = z.uuid().safeParse(req.params.id);
      if (!parsedId.success) {
        return res.status(400).json({ data: null, error: 'Invalid sprint id' });
      }

      const controller = new AbortController();
      let responseFinished = false;
      const cleanup = () => {
        req.removeListener('aborted', onRequestAborted);
        res.removeListener('finish', onResponseFinish);
        res.removeListener('close', onResponseClose);
      };
      const onRequestAborted = () => controller.abort();
      const onResponseFinish = () => {
        responseFinished = true;
        cleanup();
      };
      const onResponseClose = () => {
        if (!responseFinished) controller.abort();
        cleanup();
      };
      req.once('aborted', onRequestAborted);
      res.once('finish', onResponseFinish);
      res.once('close', onResponseClose);

      try {
        const estimation = await sprintEstimationService.generate(
          req.userId!,
          parsedId.data,
          controller.signal
        );
        if (controller.signal.aborted || res.destroyed) return;
        return res.status(200).json({ data: estimation, error: null });
      } catch (error) {
        if (
          controller.signal.aborted ||
          res.destroyed ||
          error instanceof SprintEstimationCancelledError
        ) {
          return;
        }
        if (error instanceof SprintEstimationUnauthenticatedError) {
          return res.status(401).json({ data: null, error: 'Unauthorized' });
        }
        if (error instanceof SprintEstimationForbiddenError) {
          return res.status(403).json({ data: null, error: 'Forbidden' });
        }
        if (error instanceof SprintEstimationNotFoundError) {
          return res
            .status(404)
            .json({ data: null, error: 'Sprint not found' });
        }
        if (error instanceof SprintEstimationLimitError) {
          return res.status(422).json({
            data: null,
            error: error.message,
          });
        }
        return res
          .status(500)
          .json({ data: null, error: 'Failed to estimate sprint' });
      } finally {
        cleanup();
      }
    }
  );

  sprintsRouter.get(
    '/:id/burndown',
    requireApiAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const burndown = await sprintBurndownService.getBurndown(
          req.params.id!
        );
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

  sprintsRouter.get(
    '/',
    requireApiAuth,
    async (req: AuthenticatedRequest, res) => {
      const parsed = listSprintsQueryFromRequest(
        req.query as Record<string, unknown>
      );
      if (!parsed.success) {
        return res.status(400).json({ error: z.treeifyError(parsed.error) });
      }

      try {
        const result = await sprintsService.listSprintsPaginated(
          parsed.data,
          req.userId!
        );
        res.json(result);
      } catch (error) {
        if (error instanceof SprintAccessError) {
          return res.status(403).json({ error: error.message });
        }
        const message =
          error instanceof Error ? error.message : 'Failed to list sprints';
        res.status(500).json({ error: message });
      }
    }
  );

  sprintsRouter.get(
    '/:id',
    requireApiAuth,
    async (req: AuthenticatedRequest, res) => {
      const parsedId = z.uuid().safeParse(req.params.id);
      if (!parsedId.success) {
        return res.status(400).json({ data: null, error: 'Invalid sprint id' });
      }

      try {
        const sprint = await sprintsService.getSprintDetail(
          parsedId.data,
          req.userId!
        );
        if (!sprint) {
          return res
            .status(404)
            .json({ data: null, error: 'Sprint not found' });
        }
        res.json({ data: sprint, error: null });
      } catch (error) {
        if (error instanceof SprintAccessError) {
          return res.status(403).json({ data: null, error: error.message });
        }
        const message =
          error instanceof Error ? error.message : 'Failed to get sprint';
        res.status(500).json({ data: null, error: message });
      }
    }
  );

  sprintsRouter.delete(
    '/:id',
    requireApiAuth,
    async (req: AuthenticatedRequest, res) => {
      const { id } = req.params;
      if (!id) {
        return res.status(400).json({ error: 'Sprint ID is required' });
      }

      const parsedId = z.uuid().safeParse(id);
      if (!parsedId.success) {
        return res.status(400).json({ error: 'Invalid sprint id' });
      }

      const rawAction =
        req.body?.workItemsAction ??
        req.query.workItemsAction ??
        DeleteSprintWorkItemsActionEnum.MoveOut;

      const parsed = deleteSprintActionSchema.safeParse({
        workItemsAction: rawAction,
      });

      if (!parsed.success) {
        return res.status(400).json({ error: z.treeifyError(parsed.error) });
      }

      try {
        await sprintsService.hardDeleteSprint(
          req.userId!,
          parsedId.data,
          parsed.data
        );
        res.json({ success: true });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Failed to delete sprint';

        // 1. Handle 403 authorization error edge case first
        if (
          error instanceof SprintAccessError ||
          message.startsWith('Unauthorized')
        ) {
          return res.status(403).json({ error: message });
        }

        const errorRules = [
          { search: 'not found', status: 404 },
          { search: 'Only archived sprints', status: 400 },
        ];

        const match = errorRules.find((rule) => message.includes(rule.search));
        const statusCode = match ? match.status : 500;

        return res.status(statusCode).json({ error: message });
      }
    }
  );

  return sprintsRouter;
}
