import { Router } from 'express';
import { z } from 'zod';
import {
  agentIdFromMentionId,
  applyWorkItemAiProposalBodySchema,
} from '@repo/types';
import {
  requireApiAuth,
  type AuthenticatedRequest,
} from '../../../middlewares/auth';
import { trySendOptimisticLockError } from '../../../lib/optimistic-lock';
import { ChatAgentRuntimeAccessError } from '../chat/chat-agent-runtime';
import { CommentAccessError } from '../comments/comments.errors';
import { WorkItemAccessError } from './work-items.errors';
import {
  WorkItemAiProposalTokenError,
  type WorkItemAiProposalTokenErrorCode,
} from './work-item-ai-proposal-token';
import {
  WorkItemAiProposalError,
  type WorkItemAiProposalService,
} from './work-item-ai-proposals.service';

const selectedAgentIdSchema = z
  .string()
  .transform((value) => agentIdFromMentionId(value) ?? value)
  .pipe(z.uuid('Agent ID must be a valid UUID'));

export const generateWorkItemAiProposalsBodySchema = z
  .object({
    agentId: selectedAgentIdSchema,
    commentIds: z.array(z.uuid()).max(12).default([]),
    context: z.string().trim().max(4_000).optional(),
  })
  .strict()
  .refine(
    (value) => new Set(value.commentIds).size === value.commentIds.length,
    { message: 'Comment IDs must be unique', path: ['commentIds'] }
  );

export type WorkItemAiProposalsRouterDeps = {
  proposalService: WorkItemAiProposalService;
};

function proposalErrorStatus(error: WorkItemAiProposalError): number {
  switch (error.code) {
    case 'invalid_context':
    case 'invalid_token':
    case 'expired':
    case 'done':
    case 'archived':
      return 400;
    case 'not_found':
      return 404;
    case 'stale':
      return 409;
    case 'invalid_response':
    case 'generation_failed':
      return 502;
    case 'configuration':
      return 503;
    case 'timeout':
      return 504;
    case 'cancelled':
      return 408;
  }
}

function tokenErrorStatus(error: WorkItemAiProposalTokenError): number {
  const code: WorkItemAiProposalTokenErrorCode = error.code;
  if (code === 'user_mismatch') {
    return 403;
  }
  if (code === 'stale') {
    return 409;
  }
  return 400;
}

export function createWorkItemAiProposalsRouter(
  deps: WorkItemAiProposalsRouterDeps
): Router {
  const router = Router();

  router.post(
    '/:id/ai-proposals',
    requireApiAuth,
    async (req: AuthenticatedRequest, res) => {
      const workItemId = z.uuid().safeParse(req.params.id);
      const body = generateWorkItemAiProposalsBodySchema.safeParse(req.body);
      if (!workItemId.success || !body.success) {
        let validationError: unknown = 'Invalid work item id';
        if (workItemId.success && !body.success) {
          validationError = z.treeifyError(body.error);
        }
        return res.status(400).json({
          data: null,
          error: validationError,
        });
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
        const data = await deps.proposalService.generate({
          actorId: req.userId!,
          workItemId: workItemId.data,
          agentId: body.data.agentId,
          commentIds: body.data.commentIds,
          context: body.data.context,
          signal: controller.signal,
        });
        if (controller.signal.aborted || res.destroyed) {
          return;
        }
        res.json({ data, error: null });
      } catch (error) {
        if (controller.signal.aborted || res.destroyed) {
          return;
        }
        if (
          error instanceof WorkItemAccessError ||
          error instanceof CommentAccessError ||
          error instanceof ChatAgentRuntimeAccessError
        ) {
          return res.status(403).json({
            data: null,
            error: error.message,
          });
        }
        if (error instanceof WorkItemAiProposalError) {
          return res.status(proposalErrorStatus(error)).json({
            data: null,
            error: error.message,
            code: error.code,
          });
        }
        console.error('error. failed to generate work-item proposals');
        res.status(500).json({
          data: null,
          error: 'Failed to generate work-item suggestions.',
        });
      } finally {
        cleanup();
      }
    }
  );

  router.post(
    '/:id/ai-proposals/apply',
    requireApiAuth,
    async (req: AuthenticatedRequest, res) => {
      const workItemId = z.uuid().safeParse(req.params.id);
      const body = applyWorkItemAiProposalBodySchema.safeParse(req.body);
      if (!workItemId.success || !body.success) {
        let validationError: unknown = 'Invalid work item id';
        if (workItemId.success && !body.success) {
          validationError = z.treeifyError(body.error);
        }
        return res.status(400).json({
          data: null,
          error: validationError,
        });
      }

      try {
        const data = await deps.proposalService.apply({
          actorId: req.userId!,
          workItemId: workItemId.data,
          token: body.data.token,
          title: body.data.title,
          description: body.data.description,
          expectedUpdatedAt: body.data.expectedUpdatedAt,
        });
        res.json({ data, error: null });
      } catch (error) {
        if (trySendOptimisticLockError(res, error)) {
          return;
        }
        if (
          error instanceof WorkItemAccessError ||
          error instanceof CommentAccessError ||
          error instanceof ChatAgentRuntimeAccessError
        ) {
          return res.status(403).json({
            data: null,
            error: error.message,
          });
        }
        if (error instanceof WorkItemAiProposalTokenError) {
          return res.status(tokenErrorStatus(error)).json({
            data: null,
            error: error.message,
            code: error.code,
          });
        }
        if (error instanceof WorkItemAiProposalError) {
          return res.status(proposalErrorStatus(error)).json({
            data: null,
            error: error.message,
            code: error.code,
          });
        }
        console.error('error. failed to apply work-item proposal', error);
        res.status(500).json({
          data: null,
          error: 'Failed to apply work-item suggestion.',
        });
      }
    }
  );

  return router;
}
