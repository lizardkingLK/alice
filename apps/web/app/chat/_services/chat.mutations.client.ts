import { apiFetch } from '@/lib/api/api-fetch.mutations.use.client';
import type { ActionItem, ChatMessage } from '../_components/chat-client.types';
import type { ChatModelValue } from '@repo/types';

/** Gemini + tool rounds often exceed the default 20s apiFetch abort. */
const CHAT_FETCH_TIMEOUT_MS = 90_000;

export type { ChatConversation } from '../_components/chat-client.types';

export async function sendChatMessage(
  history: ChatMessage[],
  conversationId: string | undefined,
  modelId: ChatModelValue
) {
  return apiFetch<{
    reply: string;
    history: ChatMessage[];
    actions?: ActionItem[];
    conversationId: string;
    title: string;
    is_processing?: boolean;
    error?: string;
  }>('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ messages: history, conversationId, modelId }),
    timeoutMs: CHAT_FETCH_TIMEOUT_MS,
  });
}

export async function getChatHistory(conversationId?: string) {
  const url = conversationId ? `/api/chat/${conversationId}` : '/api/chat';
  return apiFetch<{
    history: ChatMessage[];
    conversationId?: string;
    error?: string;
  }>(url, {
    method: 'GET',
  });
}

export async function deleteConversation(conversationId: string) {
  return apiFetch<{
    success: boolean;
    error?: string;
  }>(`/api/chat/${conversationId}`, {
    method: 'DELETE',
  });
}
