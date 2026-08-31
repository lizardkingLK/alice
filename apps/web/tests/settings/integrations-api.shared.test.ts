/* eslint-disable no-unused-vars, @typescript-eslint/no-unused-vars */
import { describe, expect, it, vi } from 'vitest';
import {
  INTEGRATIONS_API_PATH,
  createIntegrationsService,
} from '@/app/settings/_services/integrations-api.shared';

describe('createIntegrationsService', () => {
  it('lists integrations from the workspace API', async () => {
    const integration = {
      id: '11111111-1111-4111-8111-111111111111',
      catalog_id: 'openai',
      category: 'ai_agent',
      provider: 'openai',
      name: 'GPT-4o',
      status: 'active',
      config: {
        kind: 'chat_model',
        model: 'gpt-4o',
        display_label: 'GPT-4o',
        has_api_key: true,
      },
      is_default: false,
      sort_order: 0,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    };
    const apiFetch = vi.fn(
      async <T>(_path: string, _init?: RequestInit): Promise<T> =>
        ({ integrations: [integration] }) as T
    ) as <T>(path: string, init?: RequestInit) => Promise<T>;

    const service = createIntegrationsService(apiFetch);
    const integrations = await service.listIntegrations();

    expect(apiFetch).toHaveBeenCalledWith(INTEGRATIONS_API_PATH);
    expect(integrations).toEqual([integration]);
  });

  it('creates integrations with a JSON body', async () => {
    const apiFetch = vi.fn(
      async <T>(_path: string, _init?: RequestInit): Promise<T> =>
        ({
          integration: { id: '11111111-1111-4111-8111-111111111111' },
        }) as T
    ) as <T>(path: string, init?: RequestInit) => Promise<T>;
    const service = createIntegrationsService(apiFetch);
    const body = {
      catalog_id: 'openai',
      category: 'ai_agent' as const,
      provider: 'openai',
      name: 'GPT-4o',
      config: {
        kind: 'chat_model' as const,
        model: 'gpt-4o',
        display_label: 'GPT-4o',
        api_key: 'sk-test',
      },
    };

    await service.createIntegration(body);

    expect(apiFetch).toHaveBeenCalledWith(INTEGRATIONS_API_PATH, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  });
});
