import { Router, type Response } from 'express';
import { z } from 'zod';
import {
  requireApiAuth,
  type AuthenticatedRequest,
} from '../../../middlewares/auth';
import { ChatRoles, parseChatRole } from '@repo/types';
import { ChatProviderError } from '../integrations/chat-providers/chat-provider.error';
import { type ChatService, sanitizeLog } from './chat.service';
import {
  chatConversationIdParamSchema,
  postChatMessageBodySchema,
} from './chat.schemas';
import type { StoredChatMessage } from './chat.route.types';

export type ChatRouterDeps = {
  chatService: ChatService;
};

function sendChatError(
  res: Response,
  error: unknown,
  fallback: string,
  logLabel: string
) {
  const message = error instanceof Error ? error.message : fallback;
  const statusCode =
    error instanceof ChatProviderError ? error.statusCode : 500;
  console.error(`${logLabel}:`, sanitizeLog(message));
  res.status(statusCode).json({ error: message });
}

/** Returns false after sending 403 when the user does not own the conversation. */
async function requireConversationOwner(
  chatService: ChatService,
  res: Response,
  userId: string,
  conversationId: string
): Promise<boolean> {
  const isOwner = await chatService.verifyConversationOwner(
    userId,
    conversationId
  );
  if (!isOwner) {
    res.status(403).json({
      error: 'Access denied: You do not own this conversation.',
    });
    return false;
  }
  return true;
}

function parseConversationIdParam(
  res: Response,
  rawId: string | undefined
): string | undefined {
  const parsed = chatConversationIdParamSchema.safeParse(rawId);
  if (!parsed.success) {
    res.status(400).json({ error: z.treeifyError(parsed.error) });
    return undefined;
  }
  return parsed.data;
}

async function resolveOwnedConversationId(
  chatService: ChatService,
  res: Response,
  userId: string,
  rawId: string | undefined
): Promise<string | undefined> {
  const conversationId = parseConversationIdParam(res, rawId);
  if (!conversationId) {
    return undefined;
  }

  if (
    !(await requireConversationOwner(chatService, res, userId, conversationId))
  ) {
    return undefined;
  }

  return conversationId;
}

export function createChatRouter(deps: ChatRouterDeps): Router {
  const { chatService } = deps;
  const chatRouter: Router = Router();

  chatRouter.get(
    '/',
    requireApiAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const list = await chatService.listConversations(req.userId!);
        if (list.length > 0 && list[0]) {
          const history = await chatService.loadChatHistory(list[0].id);
          return res.json({ history, conversationId: list[0].id });
        }
        res.json({ history: [] });
      } catch (error: unknown) {
        sendChatError(
          res,
          error,
          'Failed to load chat history',
          'error. loading chat history failed'
        );
      }
    }
  );

  chatRouter.get(
    '/:conversationId',
    requireApiAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const conversationId = await resolveOwnedConversationId(
          chatService,
          res,
          req.userId!,
          req.params.conversationId
        );
        if (!conversationId) {
          return;
        }
        const history = await chatService.loadChatHistory(conversationId);
        res.json({ history });
      } catch (error: unknown) {
        sendChatError(
          res,
          error,
          'Failed to load conversation history',
          'error. load conversation history failed'
        );
      }
    }
  );

  chatRouter.delete(
    '/:conversationId',
    requireApiAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const conversationId = await resolveOwnedConversationId(
          chatService,
          res,
          req.userId!,
          req.params.conversationId
        );
        if (!conversationId) {
          return;
        }
        await chatService.deleteConversation(req.userId!, conversationId);
        res.json({ success: true });
      } catch (error: unknown) {
        sendChatError(
          res,
          error,
          'Failed to delete conversation',
          'error. delete conversation failed'
        );
      }
    }
  );

  chatRouter.post(
    '/',
    requireApiAuth,
    async (req: AuthenticatedRequest, res) => {
      const validation = postChatMessageBodySchema.safeParse(req.body);
      if (!validation.success) {
        return res
          .status(400)
          .json({ error: z.treeifyError(validation.error) });
      }

      const {
        messages,
        conversationId: reqConversationId,
        modelId,
        integrationId,
      } = validation.data;

      let chatModelConfig;
      try {
        chatModelConfig = await chatService.resolveChatModelForChat({
          integrationId,
          legacyModelId: modelId,
        });
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : 'No chat model configured';
        return res.status(400).json({ error: message });
      }

      try {
        const sanitizedInputMessages: StoredChatMessage[] = messages.map(
          (msg, index) => ({
            id: msg.id || `msg-${Date.now()}-${index}`,
            role: parseChatRole(msg.role),
            content: msg.content || msg.text || '',
            actions: msg.actions || [],
          })
        );

        let conversationId = reqConversationId;
        let title = 'New Chat';

        if (!conversationId) {
          // Process first message synchronously to ensure Gemini succeeds before database/sidebar creation
          const { responseText, toolActionsPerformed } =
            await chatService.generateChatResponse(
              req.userId!,
              sanitizedInputMessages,
              chatModelConfig
            );

          const firstMsgText =
            messages[0]?.content || messages[0]?.text || 'New Chat';
          title = firstMsgText.slice(0, 30);
          if (firstMsgText.length > 30) title += '...';
          conversationId = await chatService.createConversation(
            req.userId!,
            title,
            false
          );

          const newAssistantMessage: StoredChatMessage = {
            id: `msg-${Date.now()}`,
            role: ChatRoles.Assistant,
            content: responseText,
            actions: toolActionsPerformed,
          };
          const fullHistory = [...sanitizedInputMessages, newAssistantMessage];
          await chatService.saveChatHistory(conversationId, fullHistory);

          try {
            await chatService.notifyChatProcessed({
              userId: req.userId!,
              message: `Your request in "${title}" has been processed.`,
              relatedItemId: conversationId,
            });
          } catch (error) {
            console.error(
              'Failed to create notification for synchronous chat:',
              error
            );
          }

          return res.json({
            reply: responseText,
            history: fullHistory,
            actions: toolActionsPerformed,
            conversationId,
            title,
            is_processing: false,
          });
        } else {
          if (
            !(await requireConversationOwner(
              chatService,
              res,
              req.userId!,
              conversationId
            ))
          ) {
            return;
          }

          await chatService.setProcessingStatus(conversationId, true);

          // Save the user's incoming message immediately to history
          await chatService.saveChatHistory(
            conversationId,
            sanitizedInputMessages
          );

          // Start background processing
          chatService
            .processChatAsync(
              req.userId!,
              conversationId,
              sanitizedInputMessages,
              chatModelConfig
            )
            .catch((err) => {
              console.error('Error starting async process:', err);
            });

          return res.json({
            reply: 'Processing request...',
            history: sanitizedInputMessages,
            actions: [],
            conversationId,
            title,
            is_processing: true,
          });
        }
      } catch (error: unknown) {
        sendChatError(
          res,
          error,
          'Failed to process message',
          'error. chatbot processing failed'
        );
      }
    }
  );

  return chatRouter;
}
