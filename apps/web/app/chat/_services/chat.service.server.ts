import { getUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { apiFetch } from '@/lib/api/api-client.server';
import { throwIfError } from '@/lib/db/query';
import { unstable_cache } from 'next/cache';
import type {
  ChatConversation,
  ChatMessage,
} from '../_components/chat-client.types';

export type { ChatConversation } from '../_components/chat-client.types';

export type ChatPageBootstrap = {
  conversations: ChatConversation[];
  activeConversationId?: string;
  messages: ChatMessage[];
};

/**
 * Lists the current user's chat conversations via direct Supabase (RSC).
 * Mirrors API `listConversations` filters/order.
 */
export async function listChatConversations(): Promise<ChatConversation[]> {
  return listChatConversationsWith((userId) =>
    getCachedChatConversationsForUser(userId)
  );
}

/** Uncached list for client refreshes (drawer / after send or delete). */
export async function listChatConversationsLive(): Promise<ChatConversation[]> {
  return listChatConversationsWith(fetchChatConversationsForUser);
}

async function listChatConversationsWith(
  // eslint-disable-next-line no-unused-vars
  loader: (userId: string) => Promise<ChatConversation[]>
): Promise<ChatConversation[]> {
  const user = await getUser();
  if (!user) {
    return [];
  }

  return loader(user.id);
}

async function fetchChatConversationsForUser(
  userId: string
): Promise<ChatConversation[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('chat_conversations')
    .select('id, title, created_at, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  throwIfError(
    error,
    'failed to list chat conversations',
    'Failed to list conversations'
  );

  return data ?? [];
}

// Cache conversations list to reduce RSC latency.
// Note: this is user-scoped (cache key includes `userId`).
const getCachedChatConversationsForUser = unstable_cache(
  fetchChatConversationsForUser,
  ['chat-conversations'],
  {
    revalidate: 30,
    // Keep it simple for now; if we later add read-your-writes invalidation,
    // we can add updateTag + tags here.
  }
);

/**
 * Loads one conversation's message history.
 * History lives in private Storage and is served by the API service-role
 * client, so this uses server `apiFetch` (still RSC — no browser hop).
 */
export async function getChatHistoryServer(
  conversationId: string
): Promise<ChatMessage[]> {
  const response = await apiFetch<{
    history: ChatMessage[];
    error?: string;
  }>(`/api/chat/${conversationId}`, { method: 'GET' });

  if (response.error) {
    throw new Error(response.error);
  }

  return response.history ?? [];
}

/**
 * Prefetch conversations + latest thread for `/chat` in one RSC pass.
 */
export async function getChatPageBootstrap(): Promise<ChatPageBootstrap> {
  const conversations = await listChatConversations();
  const latest = conversations[0];

  if (!latest) {
    return { conversations: [], messages: [] };
  }

  let messages: ChatMessage[] = [];
  try {
    messages = await getChatHistoryServer(latest.id);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('error. failed to prefetch chat history:', message);
  }

  return {
    conversations,
    activeConversationId: latest.id,
    messages,
  };
}
