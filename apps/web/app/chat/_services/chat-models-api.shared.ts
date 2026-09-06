import type { ChatModelOption } from '@repo/types';
import { chatModelOptionsResponseSchema } from '@repo/types/api/v1';

export const CHAT_MODELS_API_PATH = '/api/v1/integrations/chat-models';

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

const CHAT_PROVIDER_DISPLAY_LABELS: Readonly<Record<string, string>> = {
  gemini: 'Gemini',
  spacexai: 'SpaceXAI',
  openai: 'OpenAI',
  anthropic: 'Anthropic',
};

/** Human label for a chat provider slug in the model menu. */
export function chatProviderDisplayLabel(provider: string): string {
  const known = CHAT_PROVIDER_DISPLAY_LABELS[provider];
  if (known) {
    return known;
  }
  if (!provider) {
    return 'Other';
  }
  return provider.charAt(0).toUpperCase() + provider.slice(1);
}

export type ChatModelProviderGroup = {
  readonly provider: string;
  readonly models: readonly ChatModelOption[];
};

/** Mark one integration as the workspace default in a local model list. */
export function withDefaultChatIntegration(
  models: readonly ChatModelOption[],
  integrationId: string
): ChatModelOption[] {
  return models.map((model) => ({
    ...model,
    is_default: model.id === integrationId,
  }));
}

/** Group active chat models by provider, preserving first-seen order. */
export function groupChatModelsByProvider(
  models: readonly ChatModelOption[]
): ChatModelProviderGroup[] {
  const order: string[] = [];
  const byProvider = new Map<string, ChatModelOption[]>();

  for (const model of models) {
    const provider = model.provider.trim() || 'other';
    const existing = byProvider.get(provider);
    if (existing) {
      existing.push(model);
      continue;
    }
    order.push(provider);
    byProvider.set(provider, [model]);
  }

  return order.map((provider) => ({
    provider,
    models: byProvider.get(provider) ?? [],
  }));
}

/* eslint-disable no-unused-vars */
export function createChatModelsService(
  apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>
) {
  async function listChatModels(): Promise<ChatModelOption[]> {
    const data = await apiFetch<ChatModelOptionsResponse>(CHAT_MODELS_API_PATH);
    const parsed = chatModelOptionsResponseSchema.safeParse(data);
    if (!parsed.success) {
      throw new Error('Invalid chat models response');
    }
    return parsed.data.models;
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
