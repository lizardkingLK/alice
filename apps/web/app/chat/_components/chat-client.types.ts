import type {
  ChatConversationSummaryWire,
  ChatMessageWire,
  ChatToolActionWire,
} from '@repo/types/api/v1';

export type ActionItem = ChatToolActionWire;
export type ChatMessage = ChatMessageWire;
export type ChatConversation = ChatConversationSummaryWire;
