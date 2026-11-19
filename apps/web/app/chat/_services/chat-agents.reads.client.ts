import { apiFetch } from '@/lib/api/api-fetch.mutations.use.client';
import type { ListChatAgentsQuery } from '@repo/types/api/v1';
import { createChatAgentsService } from './chat-agents-api.shared';

const service = createChatAgentsService(apiFetch);

export const listChatAgentsClient = (query?: ListChatAgentsQuery) =>
  service.listChatAgents(query);

export const getChatAgentClient = (id: string) => service.getChatAgent(id);

export const listChatToolsClient = () => service.listChatTools();

export const listChatSkillsClient = () => service.listChatSkills();
