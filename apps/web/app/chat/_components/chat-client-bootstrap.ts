import type { ChatConversation, ChatMessage } from './chat-client.types';
import { getChatHistory } from '../_services/chat.mutations.client';
import { listChatModelsForChatClient } from '../_services/chat-models.reads.client';
import { listChatConversationsAction } from '../_services/chat.reads.actions.server';
import type { ChatModelOption } from '@repo/types';

export type HistoryLoadResult = {
  messages: ChatMessage[];
  error: string | null;
};

export type LatestChatBootstrap = {
  conversations: ChatConversation[];
  activeConversationId?: string;
  messages: ChatMessage[];
  chatModels: ChatModelOption[];
};

/** Load one conversation's history; normalizes API + network errors. */
export async function loadConversationHistory(
  conversationId: string
): Promise<HistoryLoadResult> {
  try {
    const response = await getChatHistory(conversationId);
    if (response.error) {
      return { messages: [], error: response.error };
    }
    return { messages: response.history ?? [], error: null };
  } catch (err: unknown) {
    console.error('Failed to load conversation history:', err);
    return {
      messages: [],
      error: 'Failed to load conversation history.',
    };
  }
}

/**
 * List conversations and hydrate the latest thread.
 * Shared by `/chat` client init and the floating drawer bootstrap.
 */
export async function bootstrapLatestChat(): Promise<LatestChatBootstrap> {
  const [conversations, chatModels] = await Promise.all([
    listChatConversationsAction(),
    listChatModelsForChatClient(),
  ]);
  const latest = conversations[0];

  if (!latest) {
    return { conversations, messages: [], chatModels };
  }

  const history = await loadConversationHistory(latest.id);
  return {
    conversations,
    activeConversationId: latest.id,
    messages: history.messages,
    chatModels,
  };
}
