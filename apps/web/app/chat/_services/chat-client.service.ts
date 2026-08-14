import { apiFetch } from '@/lib/api/api-client';
import type { ActionItem, ChatMessage } from '../_components/chat-client.types';
import type { ChatModelValue } from '@repo/types';

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
    error?: string;
  }>('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ messages: history, conversationId, modelId }),
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
