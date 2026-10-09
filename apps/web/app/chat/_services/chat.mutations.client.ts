import {
  applyWorkflowPatchBodySchema,
  postChatMessageBodySchema,
  renameChatConversationBodySchema,
  type ApplyWorkflowPatchBody,
  type ChatDeleteResponse,
  type ChatHistoryResponse,
  type ChatMessageWire,
  type ChatPostResponse,
  type ChatToolActionWire,
  type ChatViewContext,
  type RenameChatConversationResponse,
  type WorkflowConfigEnvelope,
} from '@repo/types/api/v1';
import type { ChatAttachmentWire } from '@repo/types';
import { formatZodError } from '@/lib/zod/format-zod-error';
import { apiFetch } from '@/lib/api/api-fetch.mutations.use.client';

/** Gemini + tool rounds often exceed the default 20s apiFetch abort. */
const CHAT_FETCH_TIMEOUT_MS = 90_000;

const chatPath = '/api/v1/chat';

export type ActionItem = ChatToolActionWire;
export type ChatMessage = ChatMessageWire;
export type { ChatConversationSummaryWire as ChatConversation } from '@repo/types/api/v1';

export type ApplyWorkflowPatchResponse = {
  readonly config: WorkflowConfigEnvelope;
  readonly usedFallback: boolean;
  readonly updatedAt: string;
};

export async function sendChatMessage(
  history: ChatMessage[],
  conversationId: string | undefined,
  integrationId: string | undefined,
  attachments?: ChatAttachmentWire[],
  viewContext?: ChatViewContext | null
): Promise<ChatPostResponse> {
  const parsed = postChatMessageBodySchema.safeParse({
    messages: history,
    conversationId,
    integrationId,
    attachments,
    viewContext: viewContext ?? undefined,
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

export async function applyWorkflowPatch(
  body: ApplyWorkflowPatchBody
): Promise<ApplyWorkflowPatchResponse> {
  const parsed = applyWorkflowPatchBodySchema.safeParse(body);
  if (!parsed.success) {
    throw new Error(formatZodError(parsed.error));
  }

  return apiFetch<ApplyWorkflowPatchResponse>(
    `${chatPath}/workflow-patch/apply`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(parsed.data),
      timeoutMs: CHAT_FETCH_TIMEOUT_MS,
    }
  );
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

export async function renameConversation(
  conversationId: string,
  title: string
): Promise<RenameChatConversationResponse> {
  const parsed = renameChatConversationBodySchema.safeParse({ title });
  if (!parsed.success) {
    throw new Error(formatZodError(parsed.error));
  }

  return apiFetch<RenameChatConversationResponse>(
    `${chatPath}/${conversationId}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(parsed.data),
    }
  );
}

export async function generateFieldsSchemaWithAlice(
  prompt: string,
  currentSchema?: unknown
): Promise<{ schema: unknown }> {
  return apiFetch<{ schema: unknown }>(`${chatPath}/generate-fields-schema`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prompt, currentSchema }),
    timeoutMs: CHAT_FETCH_TIMEOUT_MS,
  });
}
