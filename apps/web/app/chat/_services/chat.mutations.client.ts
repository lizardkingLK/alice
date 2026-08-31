import {
  postChatMessageBodySchema,
  type ChatDeleteResponse,
  type ChatHistoryResponse,
  type ChatMessageWire,
  type ChatPostResponse,
  type ChatToolActionWire,
} from '@repo/types/api/v1';
import { formatZodError } from '@/lib/zod/format-zod-error';
import { apiFetch } from '@/lib/api/api-fetch.mutations.use.client';

/** Gemini + tool rounds often exceed the default 20s apiFetch abort. */
const CHAT_FETCH_TIMEOUT_MS = 90_000;

const chatPath = '/api/v1/chat';

export type ActionItem = ChatToolActionWire;
export type ChatMessage = ChatMessageWire;
export type { ChatConversationSummaryWire as ChatConversation } from '@repo/types/api/v1';

export async function sendChatMessage(
  history: ChatMessage[],
  conversationId: string | undefined,
  integrationId: string | undefined
): Promise<ChatPostResponse> {
  const parsed = postChatMessageBodySchema.safeParse({
    messages: history,
    conversationId,
    integrationId,
  });
  if (!parsed.success) {
    throw new Error(formatZodError(parsed.error));
  }

  return apiFetch<ChatPostResponse>(chatPath, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(parsed.data),
    timeoutMs: CHAT_FETCH_TIMEOUT_MS,
  });
}

export async function getChatHistory(
  conversationId?: string
): Promise<ChatHistoryResponse> {
  const url = conversationId ? `${chatPath}/${conversationId}` : chatPath;
  return apiFetch<ChatHistoryResponse>(url, {
    method: 'GET',
  });
}

export async function deleteConversation(
  conversationId: string
): Promise<ChatDeleteResponse> {
  return apiFetch<ChatDeleteResponse>(`${chatPath}/${conversationId}`, {
    method: 'DELETE',
  });
}
