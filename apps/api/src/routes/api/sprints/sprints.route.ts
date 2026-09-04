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
import { SprintAccessError } from './sprints.errors';
import { deleteSprintActionSchema, listSprintsQuerySchema } from '@repo/types';

export type SprintsRouterDeps = {
  sprintsService: SprintsService;
  sprintBurndownService: SprintBurndownService;
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
  return res.status(500).json({ data: null, error: message });
}

export function createSprintsRouter(deps: SprintsRouterDeps): Router {
  const { sprintsService, sprintBurndownService } = deps;

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
        (req.body &&
        typeof req.body === 'object' &&
        'workItemsAction' in req.body
          ? req.body.workItemsAction
          : req.query.workItemsAction) ?? 'move_out';

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
        if (
          error instanceof SprintAccessError ||
          message.startsWith('Unauthorized')
        ) {
          return res.status(403).json({ error: message });
        }
        if (message.includes('not found')) {
          return res.status(404).json({ error: message });
        }
        if (message.includes('Only archived sprints')) {
          return res.status(400).json({ error: message });
        }
        res.status(500).json({ error: message });
      }
    }
  );

  return sprintsRouter;
}
