import type { ChatMessage } from './chat-client.types';
import {
  getChatHistory,
  listConversations,
  type ChatConversation,
} from './chat-client.service';

export type HistoryLoadResult = {
  messages: ChatMessage[];
  error: string | null;
};

export type LatestChatBootstrap = {
  conversations: ChatConversation[];
  activeConversationId?: string;
  messages: ChatMessage[];
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
  const listResponse = await listConversations();
  const conversations = listResponse.conversations ?? [];
  const latest = conversations[0];

  if (!latest) {
    return { conversations, messages: [] };
  }

  const history = await loadConversationHistory(latest.id);
  return {
    conversations,
    activeConversationId: latest.id,
    messages: history.messages,
  };
}
