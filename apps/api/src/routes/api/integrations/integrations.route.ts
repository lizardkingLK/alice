import { Router, type Response } from 'express';
import { z } from 'zod';
import { requireActorId } from '../../../lib/audit';
import { jsonErrorFromCaught } from '../../../lib/http-error-status';
import {
  requireApiAuth,
  type AuthenticatedRequest,
} from '../../../middlewares/auth';
import {
  createIntegrationBodySchema,
  listIntegrationsQuerySchema,
  patchIntegrationBodySchema,
} from './integrations.schemas';
import { IntegrationsService } from './integrations.service';

const TYPE_STRING = 'string';

function firstQueryValue(value: unknown): string | undefined {
  if (typeof value === TYPE_STRING) {
    return value as string;
  }
  if (Array.isArray(value) && typeof value[0] === TYPE_STRING) {
    return value[0] as string;
  }
  return undefined;
}

function listIntegrationsQueryFromRequest(query: Record<string, unknown>) {
  return listIntegrationsQuerySchema.safeParse({
    category: firstQueryValue(query.category),
    status: firstQueryValue(query.status),
    catalog_id: firstQueryValue(query.catalog_id),
  });
}

function sendRouteError(
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

  const { status, error: message } = jsonErrorFromCaught(
    error,
    fallbackMessage
  );
  res.status(status).json({ error: message });
}

export type IntegrationsRouterDeps = {
  integrationsService: IntegrationsService;
};

export function createIntegrationsRouter(deps: IntegrationsRouterDeps) {
  const { integrationsService } = deps;
  const integrationsRouter: Router = Router();

  integrationsRouter.get(
    '/chat-models',
    requireApiAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const actorId = requireActorId(req);
        const models = await integrationsService.listChatModels(actorId);
        res.json({ models });
      } catch (error) {
        sendRouteError(res, error, 'Failed to list chat models');
      }
    }
  );

  integrationsRouter.get(
    '/',
    requireApiAuth,
    async (req: AuthenticatedRequest, res) => {
      const parsed = listIntegrationsQueryFromRequest(
        req.query as Record<string, unknown>
      );
      if (!parsed.success) {
        return res.status(400).json({ error: z.treeifyError(parsed.error) });
      }

      try {
        const actorId = requireActorId(req);
        const integrations = await integrationsService.listIntegrations(
          actorId,
          parsed.data
        );
        res.json({ integrations });
      } catch (error) {
        sendRouteError(res, error, 'Failed to list integrations');
      }
    }
  );

  integrationsRouter.get(
    '/:id',
    requireApiAuth,
    async (req: AuthenticatedRequest, res) => {
      const parsedId = z.uuid().safeParse(req.params.id);
      if (!parsedId.success) {
        return res.status(400).json({ error: 'Invalid integration id' });
      }

      try {
        const actorId = requireActorId(req);
        const integration = await integrationsService.getIntegrationDetail(
          actorId,
          parsedId.data
        );
        if (!integration) {
          return res.status(404).json({ error: 'Integration not found' });
        }
        res.json({ integration });
      } catch (error) {
        sendRouteError(res, error, 'Failed to get integration');
      }
    }
  );

  integrationsRouter.post(
    '/',
    requireApiAuth,
    async (req: AuthenticatedRequest, res) => {
      const parsed = createIntegrationBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: z.treeifyError(parsed.error) });
      }

      try {
        const actorId = requireActorId(req);
        const integration = await integrationsService.createIntegration(
          actorId,
          parsed.data
        );
        res.status(201).json({ integration });
      } catch (error) {
        sendRouteError(res, error, 'Failed to create integration');
      }
    }
  );

  integrationsRouter.patch(
    '/:id',
    requireApiAuth,
    async (req: AuthenticatedRequest, res) => {
      const parsedId = z.uuid().safeParse(req.params.id);
      if (!parsedId.success) {
        return res.status(400).json({ error: 'Invalid integration id' });
      }

      const parsed = patchIntegrationBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: z.treeifyError(parsed.error) });
      }

      try {
        const actorId = requireActorId(req);
        const integration = await integrationsService.patchIntegration(
          actorId,
          parsedId.data,
          parsed.data
        );
        res.json({ integration });
      } catch (error) {
        sendRouteError(res, error, 'Failed to update integration');
      }
    }
  );

  integrationsRouter.delete(
    '/:id',
    requireApiAuth,
    async (req: AuthenticatedRequest, res) => {
      const parsedId = z.uuid().safeParse(req.params.id);
      if (!parsedId.success) {
        return res.status(400).json({ error: 'Invalid integration id' });
      }

      try {
        const actorId = requireActorId(req);
        await integrationsService.deleteIntegration(actorId, parsedId.data);
        res.json({ success: true });
      } catch (error) {
        sendRouteError(res, error, 'Failed to delete integration');
      }
    }
  );

  return integrationsRouter;
}
