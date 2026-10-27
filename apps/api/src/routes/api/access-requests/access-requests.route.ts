import { Router, type Response } from 'express';
import { accessRequestGrantSchema } from '@repo/types';
import { requireActorId } from '../../../lib/audit';
import {
  requireApiAuth,
  type AuthenticatedRequest,
} from '../../../middlewares/auth';
import { AccessRequestsService } from './access-requests.service';

function routeError(
  res: Response,
  error: unknown,
  fallbackMessage: string
): void {
  if (
    error instanceof Error &&
    error.message === 'Authenticated user required'
  ) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const message = error instanceof Error ? error.message : fallbackMessage;
  if (
    message.includes('Only administrators') ||
    message.includes('Unauthorized')
  ) {
    res.status(403).json({ error: message });
    return;
  }

  if (
    message.includes('not found') ||
    message.includes('already resolved') ||
    message.includes('Only pending') ||
    message.includes('No Alice user exists') ||
    message.includes('Select at least one')
  ) {
    res.status(409).json({ error: message });
    return;
  }

  res.status(500).json({ error: message });
}

function readRouteId(req: AuthenticatedRequest): string | null {
  const id = req.params.id;
  return id && typeof id === 'string' ? id : null;
}

export type AccessRequestsRouterDeps = {
  accessRequestsService: AccessRequestsService;
};

export function createAccessRequestsRouter(deps: AccessRequestsRouterDeps) {
  const { accessRequestsService } = deps;
  const accessRequestsRouter: Router = Router();

  accessRequestsRouter.get(
    '/:id/shared-memberships',
    requireApiAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const actorId = requireActorId(req);
        const id = readRouteId(req);
        if (!id) {
          return res.status(400).json({ error: 'Invalid id' });
        }

        const projects =
          await accessRequestsService.listSharedMembershipProjects(actorId, id);
        res.json({ projects });
      } catch (error) {
        routeError(res, error, 'Failed to list shared memberships');
      }
    }
  );

  accessRequestsRouter.post(
    '/:id/deny',
    requireApiAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const actorId = requireActorId(req);
        const id = readRouteId(req);
        if (!id) {
          return res.status(400).json({ error: 'Invalid id' });
        }

        await accessRequestsService.denyAccessRequest(actorId, id);
        res.json({ success: true });
      } catch (error) {
        routeError(res, error, 'Failed to deny access request');
      }
    }
  );

  accessRequestsRouter.post(
    '/:id/grant',
    requireApiAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const actorId = requireActorId(req);
        const id = readRouteId(req);
        if (!id) {
          return res.status(400).json({ error: 'Invalid id' });
        }

        const parsed = accessRequestGrantSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({
            error: parsed.error.issues[0]?.message ?? 'Invalid grant payload',
          });
        }

        await accessRequestsService.grantAccessRequest(
          actorId,
          id,
          parsed.data
        );
        res.json({ success: true });
      } catch (error) {
        routeError(res, error, 'Failed to grant access request');
      }
    }
  );

  accessRequestsRouter.delete(
    '/:id',
    requireApiAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const actorId = requireActorId(req);
        const id = readRouteId(req);
        if (!id) {
          return res.status(400).json({ error: 'Invalid id' });
        }

        await accessRequestsService.deleteAccessRequest(actorId, id);
        res.json({ success: true });
      } catch (error) {
        routeError(res, error, 'Failed to delete access request');
      }
    }
  );

  return accessRequestsRouter;
}
