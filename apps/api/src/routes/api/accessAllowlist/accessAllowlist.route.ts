import { Router, type Response } from 'express';
import { z } from 'zod';
import { requireActorId } from '../../../lib/audit';
import { trySendOptimisticLockError } from '../../../lib/optimistic-lock';
import {
  requireApiAuth,
  type AuthenticatedRequest,
} from '../../../middlewares/auth';
import { accessAllowlistService } from './accessAllowlist.service';
import { OWN_ALLOWLIST_DOMAIN_LOCKOUT_MESSAGE } from '@repo/types';
import {
  accessAllowlistCreateSchema,
  accessAllowlistLockActionSchema,
  accessAllowlistUpdateSchema,
} from './accessAllowlist.schemas';

const accessAllowlistRouter: Router = Router();

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
  if (message === OWN_ALLOWLIST_DOMAIN_LOCKOUT_MESSAGE) {
    res.status(403).json({ error: message });
    return;
  }

  res.status(500).json({ error: message });
}

function readRouteId(req: AuthenticatedRequest): string | null {
  const id = req.params.id;
  return id && typeof id === 'string' ? id : null;
}

accessAllowlistRouter.post(
  '/',
  requireApiAuth,
  async (req: AuthenticatedRequest, res) => {
    try {
      const actorId = requireActorId(req);

      const parsed = accessAllowlistCreateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: z.treeifyError(parsed.error) });
      }

      const entry = await accessAllowlistService.createAccessAllowlist(
        actorId,
        parsed.data
      );

      res.status(201).json({ entry });
    } catch (error) {
      routeError(res, error, 'Failed to create access allowlist entry');
    }
  }
);

accessAllowlistRouter.put(
  '/:id',
  requireApiAuth,
  async (req: AuthenticatedRequest, res) => {
    try {
      const actorId = requireActorId(req);
      const id = readRouteId(req);
      if (!id) {
        return res.status(400).json({ error: 'Invalid id' });
      }

      const bodyParsed = accessAllowlistUpdateSchema.safeParse(req.body);
      if (!bodyParsed.success) {
        return res
          .status(400)
          .json({ error: z.treeifyError(bodyParsed.error) });
      }

      const entry = await accessAllowlistService.updateAccessAllowlist(
        actorId,
        id,
        bodyParsed.data
      );

      res.json({ entry });
    } catch (error) {
      if (trySendOptimisticLockError(res, error)) return;
      routeError(res, error, 'Failed to update access allowlist entry');
    }
  }
);

accessAllowlistRouter.delete(
  '/:id',
  requireApiAuth,
  async (req: AuthenticatedRequest, res) => {
    try {
      const actorId = requireActorId(req);
      const id = readRouteId(req);
      if (!id) {
        return res.status(400).json({ error: 'Invalid id' });
      }

      const bodyParsed = accessAllowlistLockActionSchema.safeParse(req.body);
      if (!bodyParsed.success) {
        return res
          .status(400)
          .json({ error: z.treeifyError(bodyParsed.error) });
      }

      await accessAllowlistService.deleteAccessAllowlist(
        actorId,
        id,
        bodyParsed.data.expectedUpdatedAt
      );

      res.json({ success: true });
    } catch (error) {
      if (trySendOptimisticLockError(res, error)) return;
      routeError(res, error, 'Failed to delete access allowlist entry');
    }
  }
);

export default accessAllowlistRouter;
