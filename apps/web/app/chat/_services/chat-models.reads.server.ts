import { apiFetch } from '@/lib/api/api-fetch.reads.use.server';
import { listChatModelsWithFetch } from './chat-models-api.shared';

export const listChatModelsForChat = () => listChatModelsWithFetch(apiFetch);
