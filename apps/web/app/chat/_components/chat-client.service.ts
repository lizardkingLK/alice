import { apiFetch } from '@/lib/api/api-client';
import type { ActionItem } from './chat-client.types';

export async function sendChatMessage(
  history: { role: string; content: string }[]
) {
  return apiFetch<{
    reply: string;
    actions?: ActionItem[];
    error?: string;
  }>('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ messages: history }),
  });
}
