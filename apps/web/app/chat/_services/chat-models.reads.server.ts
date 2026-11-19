import { cache } from 'react';
import { apiFetch } from '@/lib/api/api-fetch.reads.use.server';
import { listChatModelsWithFetch } from './chat-models-api.shared';

/**
 * Request-scoped dedupe so DashboardShell + Overview productivity bootstrap
 * share one models fetch per RSC render.
 */
export const listChatModelsForChat = cache(() =>
  listChatModelsWithFetch(apiFetch)
);
