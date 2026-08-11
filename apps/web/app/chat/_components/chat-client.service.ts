import { apiFetch } from '@/lib/api/api-client';
import type { ActionItem, ChatMessage } from './chat-client.types';

export interface ChatConversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export async function sendChatMessage(
  history: ChatMessage[],
  conversationId?: string
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
    body: JSON.stringify({ messages: history, conversationId }),
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

export async function listConversations() {
  return apiFetch<{
    conversations: ChatConversation[];
    error?: string;
  }>('/api/chat/conversations', {
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
