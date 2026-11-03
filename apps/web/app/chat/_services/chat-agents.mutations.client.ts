import { apiFetch } from '@/lib/api/api-fetch.mutations.use.client';
import type { PatchChatAgentBody } from '@repo/types/api/v1';
import { createChatAgentsService } from './chat-agents-api.shared';

const service = createChatAgentsService(apiFetch);

export const forkChatAgentClient = (id: string) => service.forkChatAgent(id);

export const patchChatAgentClient = (id: string, body: PatchChatAgentBody) =>
  service.patchChatAgent(id, body);

export const deleteChatAgentClient = (id: string) =>
  service.deleteChatAgent(id);

export const setDefaultChatAgentClient = (id: string) =>
  service.setDefaultChatAgent(id);
