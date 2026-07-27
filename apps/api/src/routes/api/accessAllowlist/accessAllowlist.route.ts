import { Router, type Response } from 'express';
import { z } from 'zod';
import { requireActorId } from '@/lib/audit';
import { requireApiAuth, type AuthenticatedRequest } from '@/middlewares/auth';
import { accessAllowlistService } from '@/routes/api/accessAllowlist/accessAllowlist.service';

const accessAllowlistRouter: Router = Router();

const statusSchema = z.enum(['active', 'inactive', 'archived', 'deleted']);

const allowlistMetaFields = {
  label: z.string().max(200).optional().nullable(),
  expires_at: z.string().optional().nullable(),
  status: statusSchema.optional(),
};

const createDomainSchema = z.object({
  kind: z.literal('domain'),
  value: z.string().min(1),
  ...allowlistMetaFields,
});

const createEmailSchema = z.object({
  kind: z.literal('email'),
  value: z.email(),
  ...allowlistMetaFields,
});

const createSchema = z.discriminatedUnion('kind', [
  createDomainSchema,
  createEmailSchema,
]);

const updateSchema = z.object(allowlistMetaFields);

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

accessAllowlistRouter.get(
  '/',
  requireApiAuth,
  async (req: AuthenticatedRequest, res) => {
    try {
      const actorId = requireActorId(req);

      const statusParam =
        typeof req.query.status === 'string' ? req.query.status : undefined;

      const allowed = [
        'active',
        'inactive',
        'archived',
        'deleted',
        'all',
      ] as const;
      if (
        statusParam &&
        !allowed.includes(statusParam as (typeof allowed)[number])
      ) {
        return res.status(400).json({ error: 'Invalid status filter' });
      }

      const status =
        statusParam && statusParam !== 'all'
          ? (statusParam as z.infer<typeof statusSchema>)
          : undefined;

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

      const parsed = createSchema.safeParse(req.body);
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

      const bodyParsed = updateSchema.safeParse(req.body);
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
