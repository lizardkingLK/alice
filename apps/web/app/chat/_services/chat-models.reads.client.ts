import { apiFetch } from '@/lib/api/api-fetch.mutations.use.client';
import { listChatModelsWithFetch } from './chat-models-api.shared';

export const listChatModelsForChatClient = () =>
  listChatModelsWithFetch(apiFetch);
