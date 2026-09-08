import { z } from 'zod';
import { ChatRoles } from '../../chat.js';
import { ChatAttachmentFileTypeEnum } from '../../chat-attachments.js';
import { emptyToUndefined } from './query-preprocess.js';

/** PostgREST column list for chat conversation list reads (RSC + API parity). */
export const CHAT_CONVERSATION_POSTGREST_SELECT =
  'id, title, created_at, updated_at, is_processing' as const;

const chatRoleSchema = z.enum([ChatRoles.User, ChatRoles.Assistant]);

export const chatAttachmentWireSchema = z.object({
  id: z.string(),
  fileName: z.string(),
  fileSize: z.number(),
  mimeType: z.string(),
  storagePath: z.string(),
  url: z.string(),
  fileType: z.nativeEnum(ChatAttachmentFileTypeEnum),
});

export const createChatAttachmentUploadSessionSchema = z
  .object({
    conversation_id: z.preprocess(emptyToUndefined, z.uuid().optional()),
    conversationId: z.preprocess(emptyToUndefined, z.uuid().optional()),
    file_name: z.string().min(1).optional(),
    fileName: z.string().min(1).optional(),
    content_type: z.string().min(1).optional(),
    contentType: z.string().min(1).optional(),
    file_size: z.number().int().positive().optional(),
    fileSize: z.number().int().positive().optional(),
  })
  .refine((data) => Boolean(data.fileName || data.file_name), {
    message: 'fileName or file_name is required',
  })
  .refine((data) => Boolean(data.contentType || data.content_type), {
    message: 'contentType or content_type is required',
  })
  .refine((data) => Boolean(data.fileSize || data.file_size), {
    message: 'fileSize or file_size is required',
  });

export type CreateChatAttachmentUploadSessionBody = z.infer<
  typeof createChatAttachmentUploadSessionSchema
>;

export const finalizeChatAttachmentUploadSchema = z
  .object({
    conversation_id: z.preprocess(emptyToUndefined, z.uuid().optional()),
    conversationId: z.preprocess(emptyToUndefined, z.uuid().optional()),
    storage_path: z.string().min(1).optional(),
    storagePath: z.string().min(1).optional(),
    file_name: z.string().min(1).optional(),
    fileName: z.string().min(1).optional(),
    file_size: z.number().int().positive().optional(),
    fileSize: z.number().int().positive().optional(),
    mime_type: z.string().min(1).optional(),
    mimeType: z.string().min(1).optional(),
  })
  .refine((data) => Boolean(data.storagePath || data.storage_path), {
    message: 'storagePath or storage_path is required',
  })
  .refine((data) => Boolean(data.fileName || data.file_name), {
    message: 'fileName or file_name is required',
  })
  .refine((data) => Boolean(data.fileSize || data.file_size), {
    message: 'fileSize or file_size is required',
  })
  .refine((data) => Boolean(data.mimeType || data.mime_type), {
    message: 'mimeType or mime_type is required',
  });

export type FinalizeChatAttachmentUploadBody = z.infer<
  typeof finalizeChatAttachmentUploadSchema
>;

export const chatAttachmentUploadSessionSchema = z.object({
  upload: z.object({
    bucket: z.string().min(1),
    signedUrl: z.string().min(1),
    token: z.string().min(1),
    path: z.string().min(1),
  }),
});

export type ChatAttachmentUploadSession = z.infer<
  typeof chatAttachmentUploadSessionSchema
>;

export const uploadedChatAttachmentResultSchema = z.object({
  success: z.literal(true),
  path: z.string().min(1).optional(),
  url: z.string().min(1).optional(),
  attachment: chatAttachmentWireSchema,
});

export type UploadedChatAttachmentResult = z.infer<
  typeof uploadedChatAttachmentResultSchema
>;

export const deleteChatAttachmentResponseSchema = z.object({
  success: z.literal(true),
});

export type DeleteChatAttachmentResponse = z.infer<
  typeof deleteChatAttachmentResponseSchema
>;

export const chatAttachmentSignedUrlsSchema = z.object({
  previewUrl: z.string().min(1),
  downloadUrl: z.string().min(1),
  expiresAt: z.string(),
});

export type ChatAttachmentSignedUrls = z.infer<
  typeof chatAttachmentSignedUrlsSchema
>;

export const chatToolActionSchema = z.object({
  type: z.enum([
    'create_project',
    'create_sprint',
    'create_work_item',
    'batch_import_work_items',
  ]),
  entity: z.object({
    id: z.string(),
    name: z.string().optional(),
    key: z.string().optional(),
    title: z.string().optional(),
    status: z.string().optional(),
  }),
});

export type ChatToolActionWire = z.infer<typeof chatToolActionSchema>;

/** Wire shape for stored chat messages (Storage / API responses). */
export const chatMessageWireSchema = z.object({
  id: z.string(),
  role: chatRoleSchema,
  content: z.string(),
  actions: z.array(chatToolActionSchema).optional(),
  attachments: z.array(chatAttachmentWireSchema).optional(),
});

export type ChatMessageWire = z.infer<typeof chatMessageWireSchema>;

/** Conversation list row shared by RSC and client bootstrap. */
export const chatConversationSummarySchema = z.object({
  id: z.uuid(),
  title: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  is_processing: z.boolean(),
});

export type ChatConversationSummaryWire = z.infer<
  typeof chatConversationSummarySchema
>;

/** Raw message shape accepted on `POST /api/chat` before route sanitization. */
export const chatInputMessageSchema = z.object({
  id: z.string().optional(),
  role: z.string(),
  content: z.string().optional(),
  text: z.string().optional(),
  actions: z.array(chatToolActionSchema).optional(),
  attachments: z.array(chatAttachmentWireSchema).optional(),
});

export type ChatInputMessage = z.infer<typeof chatInputMessageSchema>;

export const postChatMessageBodySchema = z.object({
  messages: z.array(chatInputMessageSchema).min(1),
  conversationId: z.preprocess(emptyToUndefined, z.uuid().optional()),
  integrationId: z.preprocess(emptyToUndefined, z.uuid().optional()),
  modelId: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  attachments: z.array(chatAttachmentWireSchema).optional(),
});

export type PostChatMessageBody = z.infer<typeof postChatMessageBodySchema>;

export const chatConversationIdParamSchema = z.uuid();

export const chatHistoryResponseSchema = z.object({
  history: z.array(chatMessageWireSchema),
  conversationId: z.uuid().optional(),
});

export type ChatHistoryResponse = z.infer<typeof chatHistoryResponseSchema>;

export const chatPostResponseSchema = z.object({
  reply: z.string(),
  history: z.array(chatMessageWireSchema),
  actions: z.array(chatToolActionSchema).optional(),
  conversationId: z.string(),
  title: z.string(),
  is_processing: z.boolean().optional(),
});

export type ChatPostResponse = z.infer<typeof chatPostResponseSchema>;

export const chatDeleteResponseSchema = z.object({
  success: z.literal(true),
});

export type ChatDeleteResponse = z.infer<typeof chatDeleteResponseSchema>;

/** Back-compat aliases for routes importing legacy schema names. */
export const postChatMessageSchema = postChatMessageBodySchema;
