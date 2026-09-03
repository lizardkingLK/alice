import { z } from 'zod';
import { ChatRoles } from '../../chat.js';
import { emptyToUndefined } from './query-preprocess.js';

/** PostgREST column list for chat conversation list reads (RSC + API parity). */
export const CHAT_CONVERSATION_POSTGREST_SELECT =
  'id, title, created_at, updated_at, is_processing' as const;

const chatRoleSchema = z.enum([ChatRoles.User, ChatRoles.Assistant]);

export const chatToolActionSchema = z.object({
  type: z.enum(['create_project', 'create_sprint', 'create_work_item']),
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
});

export type ChatInputMessage = z.infer<typeof chatInputMessageSchema>;

export const postChatMessageBodySchema = z.object({
  messages: z.array(chatInputMessageSchema).min(1),
  conversationId: z.preprocess(emptyToUndefined, z.uuid().optional()),
  integrationId: z.preprocess(emptyToUndefined, z.uuid().optional()),
  modelId: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
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
