import { Router } from 'express';
import { z } from 'zod';
import { agentIdFromMentionId } from '@repo/types';
import {
  requireApiAuth,
  type AuthenticatedRequest,
} from '../../../middlewares/auth';
import { ChatAgentRuntimeAccessError } from '../chat/chat-agent-runtime';
import { CommentAccessError } from '../comments/comments.errors';
import { WorkItemAccessError } from './work-items.errors';
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
      return 400;
    case 'not_found':
      return 404;
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
      const abort = () => controller.abort();
      req.once('aborted', abort);
      try {
        const data = await deps.proposalService.generate({
          actorId: req.userId!,
          workItemId: workItemId.data,
          agentId: body.data.agentId,
          commentIds: body.data.commentIds,
          context: body.data.context,
          signal: controller.signal,
        });
        res.json({ data, error: null });
      } catch (error) {
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
        req.off('aborted', abort);
      }
    }
  );

  return router;
}
