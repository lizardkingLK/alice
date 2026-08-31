import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  listIntegrationsMock,
  getIntegrationDetailMock,
  listChatModelsMock,
  createIntegrationMock,
  patchIntegrationMock,
  deleteIntegrationMock,
} = vi.hoisted(() => ({
  listIntegrationsMock: vi.fn(),
  getIntegrationDetailMock: vi.fn(),
  listChatModelsMock: vi.fn(),
  createIntegrationMock: vi.fn(),
  patchIntegrationMock: vi.fn(),
  deleteIntegrationMock: vi.fn(),
}));

vi.mock('../../src/middlewares/auth', async () => {
  const { mockRequireApiAuth } = await import('../helpers/mock-api-auth.js');
  return { requireApiAuth: mockRequireApiAuth };
});

vi.mock('../../src/routes/api/integrations/integrations.service', () => {
  class IntegrationsService {
    listIntegrations = listIntegrationsMock;
    getIntegrationDetail = getIntegrationDetailMock;
    listChatModels = listChatModelsMock;
    createIntegration = createIntegrationMock;
    patchIntegration = patchIntegrationMock;
    deleteIntegration = deleteIntegrationMock;
  }

  return { IntegrationsService };
});

import { createIntegrationsRouter } from '../../src/routes/api/integrations/integrations.route';
import type { IntegrationsService } from '../../src/routes/api/integrations/integrations.service';
import { MOCK_AUTH_USER_ID } from '../helpers/mock-api-auth';
import { withMountedRouter } from '../helpers/route-test.harness';

const integrationsService = {
  listIntegrations: listIntegrationsMock,
  getIntegrationDetail: getIntegrationDetailMock,
  listChatModels: listChatModelsMock,
  createIntegration: createIntegrationMock,
  patchIntegration: patchIntegrationMock,
  deleteIntegration: deleteIntegrationMock,
} as unknown as IntegrationsService;

const integrationsRouter = createIntegrationsRouter({ integrationsService });

const integrationWire = {
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

describe('integrations routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists integrations for admins', async () => {
    listIntegrationsMock.mockResolvedValue([integrationWire]);

    await withMountedRouter(
      '/api/integrations',
      integrationsRouter,
      async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/integrations`);
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toEqual({ integrations: [integrationWire] });
        expect(listIntegrationsMock).toHaveBeenCalledWith(
          MOCK_AUTH_USER_ID,
          {}
        );
      }
    );
  });

  it('returns chat models for authenticated users', async () => {
    listChatModelsMock.mockResolvedValue([
      {
        id: integrationWire.id,
        provider: 'openai',
        name: 'GPT-4o',
        is_default: false,
        model: 'gpt-4o',
        display_label: 'GPT-4o',
      },
    ]);

    await withMountedRouter(
      '/api/integrations',
      integrationsRouter,
      async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/integrations/chat-models`);
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.models).toHaveLength(1);
        expect(listChatModelsMock).toHaveBeenCalledWith(MOCK_AUTH_USER_ID);
      }
    );
  });

  it('returns 403 when admin-only list is denied', async () => {
    listIntegrationsMock.mockRejectedValue(
      new Error('Unauthorized. Only administrators can manage integrations.')
    );

    await withMountedRouter(
      '/api/integrations',
      integrationsRouter,
      async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/integrations`);
        expect(response.status).toBe(403);
      }
    );
  });

  it('returns 403 when non-admin create is denied', async () => {
    createIntegrationMock.mockRejectedValue(
      new Error('Unauthorized. Only administrators can manage integrations.')
    );

    await withMountedRouter(
      '/api/integrations',
      integrationsRouter,
      async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/integrations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            catalog_id: 'openai',
            category: 'ai_agent',
            provider: 'openai',
            name: 'GPT-4o',
            config: {
              kind: 'chat_model',
              model: 'gpt-4o',
              display_label: 'GPT-4o',
              api_key: 'sk-test',
            },
          }),
        });

        expect(response.status).toBe(403);
      }
    );
  });

  it('creates an integration', async () => {
    createIntegrationMock.mockResolvedValue({
      ...integrationWire,
      created_by: MOCK_AUTH_USER_ID,
      updated_by: MOCK_AUTH_USER_ID,
    });

    await withMountedRouter(
      '/api/integrations',
      integrationsRouter,
      async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/integrations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            catalog_id: 'openai',
            category: 'ai_agent',
            provider: 'openai',
            name: 'GPT-4o',
            config: {
              kind: 'chat_model',
              model: 'gpt-4o',
              display_label: 'GPT-4o',
              api_key: 'sk-test',
            },
          }),
        });

        expect(response.status).toBe(201);
        expect(createIntegrationMock).toHaveBeenCalled();
      }
    );
  });

  it('returns 404 when integration detail is missing', async () => {
    getIntegrationDetailMock.mockResolvedValue(null);

    await withMountedRouter(
      '/api/integrations',
      integrationsRouter,
      async (baseUrl) => {
        const response = await fetch(
          `${baseUrl}/api/integrations/11111111-1111-4111-8111-111111111111`
        );
        expect(response.status).toBe(404);
      }
    );
  });
});
