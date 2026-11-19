import { Router, type Response } from 'express';
import { z } from 'zod';
import { requireActorId } from '../../../lib/audit';
import { jsonErrorFromCaught } from '../../../lib/http-error-status';
import {
  requireApiAuth,
  type AuthenticatedRequest,
} from '../../../middlewares/auth';
import {
  listChatAgentsQuerySchema,
  patchChatAgentBodySchema,
} from './chat-agents.schemas';
import { ChatAgentsService } from './chat-agents.service';

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

function parseAgentIdParam(
  res: Response,
  rawId: string | undefined
): string | null {
  const parsedId = z.uuid().safeParse(rawId);
  if (!parsedId.success) {
    res.status(400).json({ error: 'Invalid agent id' });
    return null;
  }
  return parsedId.data;
}

export type ChatAgentsRouterDeps = {
  chatAgentsService: ChatAgentsService;
};

export function createChatAgentsRouter(deps: ChatAgentsRouterDeps) {
  const { chatAgentsService } = deps;
  const chatAgentsRouter: Router = Router();

  chatAgentsRouter.get(
    '/',
    requireApiAuth,
    async (req: AuthenticatedRequest, res) => {
      const query = req.query as Record<string, unknown>;
      const parsed = listChatAgentsQuerySchema.safeParse({
        status: firstQueryValue(query.status),
      });
      if (!parsed.success) {
        return res.status(400).json({ error: z.treeifyError(parsed.error) });
      }

      try {
        const actorId = requireActorId(req);
        const agents = await chatAgentsService.listAgents(actorId, parsed.data);
        res.json({ agents });
      } catch (error) {
        sendRouteError(res, error, 'Failed to list chat agents');
      }
    }
  );

  const listCatalog =
    (
      load: (service: ChatAgentsService, actorId: string) => Promise<unknown>,
      responseKey: 'tools' | 'skills',
      fallbackMessage: string
    ) =>
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const actorId = requireActorId(req);
        const items = await load(chatAgentsService, actorId);
        res.json({ [responseKey]: items });
      } catch (error) {
        sendRouteError(res, error, fallbackMessage);
      }
    };

  chatAgentsRouter.get(
    '/tools',
    requireApiAuth,
    listCatalog(
      (service, actorId) => service.listTools(actorId),
      'tools',
      'Failed to list chat tools'
    )
  );

  chatAgentsRouter.get(
    '/skills',
    requireApiAuth,
    listCatalog(
      (service, actorId) => service.listSkills(actorId),
      'skills',
      'Failed to list chat skills'
    )
  );

  chatAgentsRouter.get(
    '/:id',
    requireApiAuth,
    async (req: AuthenticatedRequest, res) => {
      const agentId = parseAgentIdParam(res, req.params.id);
      if (!agentId) {
        return;
      }

      try {
        const actorId = requireActorId(req);
        const agent = await chatAgentsService.getAgent(actorId, agentId);
        res.json({ agent });
      } catch (error) {
        sendRouteError(res, error, 'Failed to load chat agent');
      }
    }
  );

  chatAgentsRouter.post(
    '/:id/fork',
    requireApiAuth,
    async (req: AuthenticatedRequest, res) => {
      const agentId = parseAgentIdParam(res, req.params.id);
      if (!agentId) {
        return;
      }

      try {
        const actorId = requireActorId(req);
        const agent = await chatAgentsService.forkAgent(actorId, agentId);
        res.status(201).json({ agent });
      } catch (error) {
        sendRouteError(res, error, 'Failed to fork chat agent');
      }
    }
  );

  chatAgentsRouter.patch(
    '/:id',
    requireApiAuth,
    async (req: AuthenticatedRequest, res) => {
      const agentId = parseAgentIdParam(res, req.params.id);
      if (!agentId) {
        return;
      }

      const parsedBody = patchChatAgentBodySchema.safeParse(req.body);
      if (!parsedBody.success) {
        return res
          .status(400)
          .json({ error: z.treeifyError(parsedBody.error) });
      }

      try {
        const actorId = requireActorId(req);
        const agent = await chatAgentsService.patchAgent(
          actorId,
          agentId,
          parsedBody.data
        );
        res.json({ agent });
      } catch (error) {
        sendRouteError(res, error, 'Failed to update chat agent');
      }
    }
  );

  chatAgentsRouter.delete(
    '/:id',
    requireApiAuth,
    async (req: AuthenticatedRequest, res) => {
      const agentId = parseAgentIdParam(res, req.params.id);
      if (!agentId) {
        return;
      }

      try {
        const actorId = requireActorId(req);
        await chatAgentsService.deleteAgent(actorId, agentId);
        res.json({ success: true });
      } catch (error) {
        sendRouteError(res, error, 'Failed to delete chat agent');
      }
    }
  );

  chatAgentsRouter.post(
    '/:id/set-default',
    requireApiAuth,
    async (req: AuthenticatedRequest, res) => {
      const agentId = parseAgentIdParam(res, req.params.id);
      if (!agentId) {
        return;
      }

      try {
        const actorId = requireActorId(req);
        const agent = await chatAgentsService.setDefault(actorId, agentId);
        res.json({ agent });
      } catch (error) {
        sendRouteError(res, error, 'Failed to set default chat agent');
      }
    }
  );

  return chatAgentsRouter;
}
