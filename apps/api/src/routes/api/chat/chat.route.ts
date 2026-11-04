import multer, { Multer } from 'multer';
import { Router, type Response } from 'express';
import { z } from 'zod';
import {
  requireApiAuth,
  type AuthenticatedRequest,
} from '../../../middlewares/auth';
import { ChatConversationKinds, ChatRoles, parseChatRole } from '@repo/types';
import { ChatProviderError } from '../integrations/chat-providers/chat-provider.error';
import { type ChatService, sanitizeLog } from './chat.service';
import {
  applyWorkflowPatchBodySchema,
  chatConversationIdParamSchema,
  createChatAttachmentUploadSessionSchema,
  finalizeChatAttachmentUploadSchema,
  postChatMessageBodySchema,
  renameChatConversationBodySchema,
  type ChatViewContext,
  type PostChatMessageBody,
} from '@repo/types/api/v1';
import type { ResolvedChatModelConfig } from '../integrations/chat-providers/chat-provider.types';
import type { StoredChatMessage } from './chat.route.types';

const chatUpload: Multer = multer({
  storage: multer.memoryStorage(),
  limits: {
    // eslint-disable-next-line sonarjs/content-length
    fileSize: 10 * 1024 * 1024,
  },
});

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

function statusFromWorkflowPatchError(error: unknown, message: string): number {
  if (
    error instanceof Error &&
    'status' in error &&
    typeof (error as { status?: unknown }).status === 'number'
  ) {
    return (error as { status: number }).status;
  }
  if (message.includes('Only admins and managers')) {
    return 403;
  }
  if (
    message.includes('expired') ||
    message.includes('confirmation token') ||
    message.includes('does not match')
  ) {
    return 400;
  }
  return 500;
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

function resolveRequestProjectId(
  requestProjectId: string | undefined,
  viewContext: ChatViewContext | undefined
): string | undefined {
  if (requestProjectId) {
    return requestProjectId;
  }
  if (viewContext && 'projectId' in viewContext) {
    return viewContext.projectId;
  }
  return undefined;
}

function sanitizeChatInputMessages(
  messages: PostChatMessageBody['messages'],
  requestAttachments: PostChatMessageBody['attachments']
): StoredChatMessage[] {
  return messages.map((msg, index) => {
    const isLastMessage = index === messages.length - 1;
    const effectiveAttachments =
      msg.attachments ||
      (isLastMessage && requestAttachments?.length
        ? requestAttachments
        : undefined);

    return {
      id: msg.id || `msg-${Date.now()}-${index}`,
      role: parseChatRole(msg.role),
      content: msg.content || msg.text || '',
      actions: msg.actions || [],
      attachments: effectiveAttachments,
    };
  });
}

async function handleNewChatPost(params: {
  readonly chatService: ChatService;
  readonly res: Response;
  readonly userId: string;
  readonly messages: PostChatMessageBody['messages'];
  readonly sanitizedInputMessages: StoredChatMessage[];
  readonly chatModelConfig: ResolvedChatModelConfig;
  readonly viewContext: ChatViewContext | undefined;
  readonly conversationKind: PostChatMessageBody['kind'];
  readonly agentId: string | null;
}): Promise<void> {
  const {
    chatService,
    res,
    userId,
    messages,
    sanitizedInputMessages,
    chatModelConfig,
    viewContext,
    conversationKind,
    agentId,
  } = params;

  // Process first message synchronously so Gemini succeeds before DB/sidebar creation
  const { responseText, toolActionsPerformed } =
    await chatService.generateChatResponse(
      userId,
      sanitizedInputMessages,
      chatModelConfig,
      viewContext,
      agentId
    );

  const firstMsgText = messages[0]?.content || messages[0]?.text || 'New Chat';
  let title = firstMsgText.slice(0, 30);
  if (firstMsgText.length > 30) {
    title += '...';
  }

  const conversationId = await chatService.createConversation(
    userId,
    title,
    false,
    conversationKind ?? ChatConversationKinds.general,
    agentId
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
      userId,
      message: `Your request in "${title}" has been processed.`,
      relatedItemId: conversationId,
    });
  } catch (error) {
    console.error('Failed to create notification for synchronous chat:', error);
  }

  res.json({
    reply: responseText,
    history: fullHistory,
    actions: toolActionsPerformed,
    conversationId,
    title,
    is_processing: false,
  });
}

async function handleExistingChatPost(params: {
  readonly chatService: ChatService;
  readonly res: Response;
  readonly userId: string;
  readonly conversationId: string;
  readonly sanitizedInputMessages: StoredChatMessage[];
  readonly chatModelConfig: ResolvedChatModelConfig;
  readonly viewContext: ChatViewContext | undefined;
  readonly agentId: string | null;
}): Promise<boolean> {
  const {
    chatService,
    res,
    userId,
    conversationId,
    sanitizedInputMessages,
    chatModelConfig,
    viewContext,
  } = params;

  if (
    !(await requireConversationOwner(chatService, res, userId, conversationId))
  ) {
    return false;
  }

  const resolvedAgentId =
    params.agentId ??
    (await chatService.getConversationAgentId(userId, conversationId));

  await chatService.setProcessingStatus(conversationId, true);
  await chatService.saveChatHistory(conversationId, sanitizedInputMessages);

  chatService
    .processChatAsync(
      userId,
      conversationId,
      sanitizedInputMessages,
      chatModelConfig,
      viewContext,
      resolvedAgentId
    )
    .catch((err) => {
      console.error('Error starting async process:', err);
    });

  res.json({
    reply: 'Processing request...',
    history: sanitizedInputMessages,
    actions: [],
    conversationId,
    title: 'New Chat',
    is_processing: true,
  });
  return true;
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
          const history = await chatService.loadChatHistory(
            req.userId!,
            list[0].id
          );
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
        const history = await chatService.loadChatHistory(
          req.userId!,
          conversationId
        );
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

  chatRouter.patch(
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
        const parsed = renameChatConversationBodySchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({ error: z.treeifyError(parsed.error) });
        }
        const renamed = await chatService.renameConversation(
          req.userId!,
          conversationId,
          parsed.data.title
        );
        res.json(renamed);
      } catch (error: unknown) {
        sendChatError(
          res,
          error,
          'Failed to rename conversation',
          'error. rename conversation failed'
        );
      }
    }
  );

  chatRouter.post(
    '/attachments/upload-session',
    requireApiAuth,
    async (req: AuthenticatedRequest, res) => {
      const parsed = createChatAttachmentUploadSessionSchema.safeParse(
        req.body
      );
      if (!parsed.success) {
        return res.status(400).json({ error: z.treeifyError(parsed.error) });
      }

      const conversationId =
        parsed.data.conversationId ?? parsed.data.conversation_id;
      const fileName = parsed.data.fileName ?? parsed.data.file_name!;
      const contentType = parsed.data.contentType ?? parsed.data.content_type!;
      const fileSize = parsed.data.fileSize ?? parsed.data.file_size!;

      try {
        const session = await chatService.chatAttachments.createUploadSession({
          userId: req.userId!,
          conversationId,
          fileName,
          contentType,
          fileSize,
        });

        return res.json(session);
      } catch (error: unknown) {
        sendChatError(
          res,
          error,
          'Failed to create upload session',
          'error. chat attachment upload session failed'
        );
      }
    }
  );

  chatRouter.post(
    '/attachments/finalize',
    requireApiAuth,
    async (req: AuthenticatedRequest, res) => {
      const parsed = finalizeChatAttachmentUploadSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: z.treeifyError(parsed.error) });
      }

      const conversationId =
        parsed.data.conversationId ?? parsed.data.conversation_id;
      const storagePath = parsed.data.storagePath ?? parsed.data.storage_path!;
      const fileName = parsed.data.fileName ?? parsed.data.file_name!;
      const fileSize = parsed.data.fileSize ?? parsed.data.file_size!;
      const mimeType = parsed.data.mimeType ?? parsed.data.mime_type!;

      try {
        const result = await chatService.chatAttachments.finalizeUpload({
          userId: req.userId!,
          conversationId,
          storagePath,
          fileName,
          fileSize,
          mimeType,
        });

        return res.json(result);
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : 'Failed to finalize upload';
        if (/Invalid upload target/i.test(message)) {
          return res.status(400).json({ error: message });
        }
        if (/Uploaded file not found in storage/i.test(message)) {
          return res.status(404).json({ error: message });
        }
        sendChatError(
          res,
          error,
          'Failed to finalize upload',
          'error. chat attachment upload finalize failed'
        );
      }
    }
  );

  chatRouter.get(
    '/attachments/:id',
    requireApiAuth,
    async (req: AuthenticatedRequest, res) => {
      const attachmentId = req.params.id;
      if (!attachmentId) {
        return res.status(400).json({ error: 'Attachment id is required' });
      }

      try {
        const attachment = await chatService.chatAttachments.getAttachmentById(
          req.userId!,
          attachmentId
        );
        if (!attachment) {
          return res.status(404).json({ error: 'Attachment not found' });
        }

        return res.json(attachment);
      } catch (error: unknown) {
        sendChatError(
          res,
          error,
          'Failed to get attachment',
          'error. chat get attachment failed'
        );
      }
    }
  );

  chatRouter.post(
    '/attachments',
    requireApiAuth,
    chatUpload.single('file'),
    async (req: AuthenticatedRequest, res) => {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const conversationId =
        typeof req.body?.conversationId === 'string'
          ? req.body.conversationId
          : undefined;

      try {
        const attachment = await chatService.chatAttachments.uploadAttachment({
          userId: req.userId!,
          conversationId,
          fileName: file.originalname,
          fileBuffer: file.buffer,
          mimeType: file.mimetype || 'application/octet-stream',
          fileSize: file.size,
        });

        return res.status(201).json({
          success: true,
          attachment,
        });
      } catch (error: unknown) {
        sendChatError(
          res,
          error,
          'Failed to upload attachment',
          'error. chat attachment upload failed'
        );
      }
    }
  );

  chatRouter.delete(
    '/attachments/:id',
    requireApiAuth,
    async (req: AuthenticatedRequest, res) => {
      const attachmentId = req.params.id;
      if (!attachmentId) {
        return res.status(400).json({ error: 'Attachment id is required' });
      }

      try {
        const deleted = await chatService.chatAttachments.deleteAttachment(
          req.userId!,
          attachmentId
        );

        if (!deleted) {
          return res.status(404).json({ error: 'Attachment not found' });
        }

        return res.json({ success: true });
      } catch (error: unknown) {
        sendChatError(
          res,
          error,
          'Failed to delete attachment',
          'error. chat attachment delete failed'
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
        projectId: requestProjectId,
        agentId: requestAgentId,
        attachments: requestAttachments,
        viewContext,
        kind: conversationKind,
      } = validation.data;

      const projectId = resolveRequestProjectId(requestProjectId, viewContext);

      let chatModelConfig: ResolvedChatModelConfig;
      try {
        chatModelConfig = await chatService.resolveChatModelForChat({
          integrationId,
          projectId,
          legacyModelId: modelId,
        });
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : 'No chat model configured';
        return res.status(400).json({ error: message });
      }

      try {
        const sanitizedInputMessages = sanitizeChatInputMessages(
          messages,
          requestAttachments
        );
        const agentId = requestAgentId ?? null;

        if (!reqConversationId) {
          await handleNewChatPost({
            chatService,
            res,
            userId: req.userId!,
            messages,
            sanitizedInputMessages,
            chatModelConfig,
            viewContext,
            conversationKind,
            agentId,
          });
          return;
        }

        await handleExistingChatPost({
          chatService,
          res,
          userId: req.userId!,
          conversationId: reqConversationId,
          sanitizedInputMessages,
          chatModelConfig,
          viewContext,
          agentId,
        });
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

  chatRouter.post(
    '/generate-fields-schema',
    requireApiAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { prompt, currentSchema } = req.body || {};
        if (!prompt || typeof prompt !== 'string') {
          return res.status(400).json({ error: 'Prompt is required' });
        }
        const schema = await chatService.generateProjectFieldsSchema(
          prompt,
          currentSchema
        );
        return res.json({ schema });
      } catch (error: unknown) {
        sendChatError(
          res,
          error,
          'Failed to generate fields schema',
          'error. generate-fields-schema failed'
        );
      }
    }
  );

  chatRouter.post(
    '/generate-chart-description',
    requireApiAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { scope, title, currentDescription, context } = req.body || {};
        if (scope !== 'widget' && scope !== 'workspace') {
          return res
            .status(400)
            .json({ error: 'scope must be widget or workspace' });
        }
        if (!title || typeof title !== 'string') {
          return res.status(400).json({ error: 'title is required' });
        }
        const description = await chatService.generateChartDescription({
          scope,
          title,
          currentDescription:
            typeof currentDescription === 'string' ? currentDescription : null,
          context,
        });
        return res.json({ description });
      } catch (error: unknown) {
        sendChatError(
          res,
          error,
          'Failed to generate chart description',
          'error. generate-chart-description failed'
        );
      }
    }
  );

  chatRouter.post(
    '/workflow-patch/apply',
    requireApiAuth,
    async (req: AuthenticatedRequest, res) => {
      const validation = applyWorkflowPatchBodySchema.safeParse(req.body);
      if (!validation.success) {
        return res
          .status(400)
          .json({ error: z.treeifyError(validation.error) });
      }

      try {
        const result = await chatService.applyWorkflowPatch(
          req.userId!,
          validation.data
        );
        return res.json(result);
      } catch (error: unknown) {
        const message =
          error instanceof Error
            ? error.message
            : 'Failed to apply workflow patch';
        const statusCode = statusFromWorkflowPatchError(error, message);
        console.error(
          'error. workflow-patch apply failed:',
          sanitizeLog(message)
        );
        return res.status(statusCode).json({ error: message });
      }
    }
  );

  return chatRouter;
}
