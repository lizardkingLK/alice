import type { ChatModelOption } from '@repo/types';

export const CHAT_MODELS_API_PATH = '/api/integrations/chat-models';

export type ChatModelOptionsResponse = {
  models: ChatModelOption[];
};

export function pickDefaultChatIntegrationId(
  models: readonly ChatModelOption[]
): string | undefined {
  if (models.length === 0) {
    return undefined;
  }

  const first = models[0];
  if (!first) {
    return undefined;
  }

  const defaultModel = models.find((model) => model.is_default);
  return defaultModel?.id ?? first.id;
}

export function resolveSelectedChatIntegrationId(
  models: readonly ChatModelOption[],
  current: string | undefined
): string | undefined {
  if (current && models.some((model) => model.id === current)) {
    return current;
  }
  return pickDefaultChatIntegrationId(models);
}

export function chatModelDisplayLabel(model: ChatModelOption): string {
  return model.display_label.trim() || model.name;
}

/* eslint-disable no-unused-vars */
export function createChatModelsService(
  apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>
) {
  async function listChatModels(): Promise<ChatModelOption[]> {
    const data = await apiFetch<ChatModelOptionsResponse>(CHAT_MODELS_API_PATH);
    return data.models;
  }

  return { listChatModels };
}

export async function listChatModelsWithFetch(
  apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>
): Promise<ChatModelOption[]> {
  try {
    return await createChatModelsService(apiFetch).listChatModels();
  } catch (error) {
    console.error('error. failed to list chat models:', error);
    return [];
  }
}
