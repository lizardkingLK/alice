/* eslint-disable no-unused-vars, @typescript-eslint/no-unused-vars */
import { describe, expect, it, vi } from 'vitest';
import type { ChatModelOption } from '@repo/types';
import {
  CHAT_MODELS_API_PATH,
  chatProviderDisplayLabel,
  groupChatModelsByProvider,
  listChatModelsWithFetch,
  pickDefaultChatIntegrationId,
  resolveSelectedChatIntegrationId,
  withDefaultChatIntegration,
} from '@/app/chat/_services/chat-models-api.shared';

const models: ChatModelOption[] = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    provider: 'gemini',
    name: 'Gemini 2.0 Flash',
    is_default: false,
    model: 'gemini-2.0-flash',
    display_label: 'Gemini 2.0 Flash',
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    provider: 'gemini',
    name: 'Gemini 3.6',
    is_default: true,
    model: 'gemini-3.6-flash',
    display_label: 'Gemini 3.6',
  },
];

describe('pickDefaultChatIntegrationId', () => {
  it('returns undefined when no models are configured', () => {
    expect(pickDefaultChatIntegrationId([])).toBeUndefined();
  });

  it('prefers the workspace default model', () => {
    expect(pickDefaultChatIntegrationId(models)).toBe(
      '22222222-2222-4222-8222-222222222222'
    );
  });

  it('falls back to the first model when none is marked default', () => {
    expect(
      pickDefaultChatIntegrationId(
        models.map((model) => ({ ...model, is_default: false }))
      )
    ).toBe('11111111-1111-4111-8111-111111111111');
  });
});

describe('resolveSelectedChatIntegrationId', () => {
  it('keeps the current selection when it still exists', () => {
    expect(
      resolveSelectedChatIntegrationId(
        models,
        '11111111-1111-4111-8111-111111111111'
      )
    ).toBe('11111111-1111-4111-8111-111111111111');
  });

  it('falls back to the default when the current selection is missing', () => {
    expect(
      resolveSelectedChatIntegrationId(models, 'missing-integration-id')
    ).toBe('22222222-2222-4222-8222-222222222222');
  });
});

describe('withDefaultChatIntegration', () => {
  it('marks only the chosen integration as default', () => {
    expect(
      withDefaultChatIntegration(models, '11111111-1111-4111-8111-111111111111')
    ).toEqual([
      { ...models[0], is_default: true },
      { ...models[1], is_default: false },
    ]);
  });
});

describe('chatProviderDisplayLabel', () => {
  it('maps known provider slugs', () => {
    expect(chatProviderDisplayLabel('gemini')).toBe('Gemini');
    expect(chatProviderDisplayLabel('spacexai')).toBe('SpaceXAI');
  });

  it('title-cases unknown providers', () => {
    expect(chatProviderDisplayLabel('acme')).toBe('Acme');
  });
});

describe('groupChatModelsByProvider', () => {
  it('groups models by provider and preserves first-seen order', () => {
    const mixed: ChatModelOption[] = [
      ...models,
      {
        id: '33333333-3333-4333-8333-333333333333',
        provider: 'spacexai',
        name: 'Grok 3',
        is_default: false,
        model: 'grok-3',
        display_label: 'Grok 3',
      },
    ];

    expect(groupChatModelsByProvider(mixed)).toEqual([
      {
        provider: 'gemini',
        models: [mixed[0], mixed[1]],
      },
      {
        provider: 'spacexai',
        models: [mixed[2]],
      },
    ]);
  });
});

describe('listChatModelsWithFetch', () => {
  it('returns models from the chat-models API', async () => {
    const apiFetch = vi.fn(
      async <T>(_path: string, _init?: RequestInit): Promise<T> =>
        ({ models }) as T
    ) as <T>(path: string, init?: RequestInit) => Promise<T>;

    await expect(listChatModelsWithFetch(apiFetch)).resolves.toEqual(models);
    expect(apiFetch).toHaveBeenCalledWith(CHAT_MODELS_API_PATH);
  });

  it('returns an empty list when the API call fails', async () => {
    const apiFetch = vi.fn(async () => {
      throw new Error('network');
    }) as <T>(path: string, init?: RequestInit) => Promise<T>;

    await expect(listChatModelsWithFetch(apiFetch)).resolves.toEqual([]);
  });
});
