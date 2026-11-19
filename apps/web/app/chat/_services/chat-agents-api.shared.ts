import {
  chatAgentDetailResponseSchema,
  listChatAgentsResponseSchema,
  listChatSkillsResponseSchema,
  listChatToolsResponseSchema,
  patchChatAgentBodySchema,
  type ChatAgentDetailWire,
  type ChatAgentSummaryWire,
  type ChatSkillCatalogWire,
  type ChatToolCatalogWire,
  type ListChatAgentsQuery,
  type PatchChatAgentBody,
} from '@repo/types/api/v1';
import { formatZodError } from '@/lib/zod/format-zod-error';

export const CHAT_AGENTS_API_PATH = '/api/v1/chat-agents';

function agentsPath(query?: ListChatAgentsQuery): string {
  if (!query?.status) {
    return CHAT_AGENTS_API_PATH;
  }
  const params = new URLSearchParams({ status: query.status });
  return `${CHAT_AGENTS_API_PATH}?${params.toString()}`;
}

/* eslint-disable no-unused-vars */
export function createChatAgentsService(
  apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>
) {
  async function listChatAgents(
    query?: ListChatAgentsQuery
  ): Promise<ChatAgentSummaryWire[]> {
    const data = await apiFetch<unknown>(agentsPath(query));
    const parsed = listChatAgentsResponseSchema.safeParse(data);
    if (!parsed.success) {
      throw new Error('Invalid chat agents response');
    }
    return parsed.data.agents;
  }

  async function getChatAgent(id: string): Promise<ChatAgentDetailWire> {
    const data = await apiFetch<unknown>(`${CHAT_AGENTS_API_PATH}/${id}`);
    const parsed = chatAgentDetailResponseSchema.safeParse(data);
    if (!parsed.success) {
      throw new Error('Invalid chat agent response');
    }
    return parsed.data.agent;
  }

  async function listChatTools(): Promise<ChatToolCatalogWire[]> {
    const data = await apiFetch<unknown>(`${CHAT_AGENTS_API_PATH}/tools`);
    const parsed = listChatToolsResponseSchema.safeParse(data);
    if (!parsed.success) {
      throw new Error('Invalid chat tools response');
    }
    return parsed.data.tools;
  }

  async function listChatSkills(): Promise<ChatSkillCatalogWire[]> {
    const data = await apiFetch<unknown>(`${CHAT_AGENTS_API_PATH}/skills`);
    const parsed = listChatSkillsResponseSchema.safeParse(data);
    if (!parsed.success) {
      throw new Error('Invalid chat skills response');
    }
    return parsed.data.skills;
  }

  async function forkChatAgent(id: string): Promise<ChatAgentDetailWire> {
    const data = await apiFetch<unknown>(`${CHAT_AGENTS_API_PATH}/${id}/fork`, {
      method: 'POST',
    });
    const parsed = chatAgentDetailResponseSchema.safeParse(data);
    if (!parsed.success) {
      throw new Error('Invalid forked chat agent response');
    }
    return parsed.data.agent;
  }

  async function patchChatAgent(
    id: string,
    body: PatchChatAgentBody
  ): Promise<ChatAgentDetailWire> {
    const parsedBody = patchChatAgentBodySchema.safeParse(body);
    if (!parsedBody.success) {
      throw new Error(formatZodError(parsedBody.error));
    }
    const data = await apiFetch<unknown>(`${CHAT_AGENTS_API_PATH}/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsedBody.data),
    });
    const parsed = chatAgentDetailResponseSchema.safeParse(data);
    if (!parsed.success) {
      throw new Error('Invalid updated chat agent response');
    }
    return parsed.data.agent;
  }

  async function deleteChatAgent(id: string): Promise<void> {
    await apiFetch<{ success: boolean }>(`${CHAT_AGENTS_API_PATH}/${id}`, {
      method: 'DELETE',
    });
  }

  async function setDefaultChatAgent(id: string): Promise<ChatAgentDetailWire> {
    const data = await apiFetch<unknown>(
      `${CHAT_AGENTS_API_PATH}/${id}/set-default`,
      { method: 'POST' }
    );
    const parsed = chatAgentDetailResponseSchema.safeParse(data);
    if (!parsed.success) {
      throw new Error('Invalid default chat agent response');
    }
    return parsed.data.agent;
  }

  return {
    listChatAgents,
    getChatAgent,
    listChatTools,
    listChatSkills,
    forkChatAgent,
    patchChatAgent,
    deleteChatAgent,
    setDefaultChatAgent,
  };
}
/* eslint-enable no-unused-vars */

export type ChatAgentsService = ReturnType<typeof createChatAgentsService>;
