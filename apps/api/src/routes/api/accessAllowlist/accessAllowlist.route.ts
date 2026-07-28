import { Router, type Response } from 'express';
import { z } from 'zod';
import {
  accessAllowlistCreateSchema,
  accessAllowlistUpdateSchema,
} from '@repo/types';
import { requireActorId } from '@/lib/audit';
import { parsePagination } from '@/lib/pagination';
import { requireApiAuth, type AuthenticatedRequest } from '@/middlewares/auth';
import { accessAllowlistService } from '@/routes/api/accessAllowlist/accessAllowlist.service';

const accessAllowlistRouter: Router = Router();

const statusFilterSchema = z.enum([
  'active',
  'inactive',
  'archived',
  'deleted',
  'all',
]);

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
  res.status(500).json({ error: message });
}

function readRouteId(req: AuthenticatedRequest): string | null {
  const id = req.params.id;
  return id && typeof id === 'string' ? id : null;
}

function parseStatusFilter(
  statusParam: string | undefined
): 'active' | 'inactive' | 'archived' | 'deleted' | undefined | 'invalid' {
  if (!statusParam) {
    return undefined;
  }

  const parsed = statusFilterSchema.safeParse(statusParam);
  if (!parsed.success) {
    return 'invalid';
  }

  return parsed.data === 'all' ? undefined : parsed.data;
}

accessAllowlistRouter.get(
  '/',
  requireApiAuth,
  async (req: AuthenticatedRequest, res) => {
    try {
      const actorId = requireActorId(req);

      const statusParam =
        typeof req.query.status === 'string' ? req.query.status : undefined;
      const status = parseStatusFilter(statusParam);
      if (status === 'invalid') {
        return res.status(400).json({ error: 'Invalid status filter' });
      }

      const searchQuery =
        typeof req.query.search === 'string' ? req.query.search : undefined;

      const pagination = parsePagination(req);
      if (pagination) {
        const { page, limit } = pagination;
        const result =
          await accessAllowlistService.listAccessAllowlistPaginated(
            actorId,
            page,
            limit,
            status,
            searchQuery
          );
        const totalPages = Math.max(1, Math.ceil(result.totalCount / limit));
        return res.json({
          items: result.items,
          totalCount: result.totalCount,
          page,
          limit,
          totalPages,
        });
      }

      const items = await accessAllowlistService.listAccessAllowlist(
        actorId,
        status
      );

      res.json({ items });
    } catch (error) {
      routeError(res, error, 'Failed to retrieve access allowlist');
    }
  }
);

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

      await accessAllowlistService.deleteAccessAllowlist(actorId, id);

      res.json({ success: true });
    } catch (error) {
      routeError(res, error, 'Failed to delete access allowlist entry');
    }
  }
);

export default accessAllowlistRouter;
