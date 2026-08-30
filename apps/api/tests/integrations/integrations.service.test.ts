import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IntegrationsService } from '../../src/routes/api/integrations/integrations.service';
import type { IntegrationsRepository } from '../../src/routes/api/integrations/integrations.repository';

vi.hoisted(() => {
  process.env.GITHUB_ACTIONS = 'true';
});

const {
  listMock,
  findByIdMock,
  findActiveChatModelByIdMock,
  findDefaultActiveChatModelMock,
  createMock,
  updateMock,
  disableMock,
  listActiveChatModelsMock,
  selectSingleMock,
} = vi.hoisted(() => ({
  listMock: vi.fn(),
  findByIdMock: vi.fn(),
  findActiveChatModelByIdMock: vi.fn(),
  findDefaultActiveChatModelMock: vi.fn(),
  createMock: vi.fn(),
  updateMock: vi.fn(),
  disableMock: vi.fn(),
  listActiveChatModelsMock: vi.fn(),
  selectSingleMock: vi.fn(),
}));

vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: selectSingleMock,
        })),
      })),
    })),
  },
}));

const repository = {
  list: listMock,
  findById: findByIdMock,
  findActiveChatModelById: findActiveChatModelByIdMock,
  findDefaultActiveChatModel: findDefaultActiveChatModelMock,
  create: createMock,
  update: updateMock,
  disable: disableMock,
  listActiveChatModels: listActiveChatModelsMock,
} as unknown as IntegrationsRepository;

const integrationRow = {
  id: '11111111-1111-4111-8111-111111111111',
  catalog_id: 'openai',
  category: 'ai_agent' as const,
  provider: 'openai',
  name: 'GPT-4o',
  status: 'active' as const,
  config: {
    kind: 'chat_model' as const,
    model: 'gpt-4o',
    display_label: 'GPT-4o',
    api_key: 'v1:encrypted',
  },
  is_default: false,
  sort_order: 0,
  created_by: 'admin-1',
  created_at: new Date('2026-01-01T00:00:00.000Z'),
  updated_by: 'admin-1',
  updated_at: new Date('2026-01-01T00:00:00.000Z'),
};

describe('IntegrationsService', () => {
  const service = new IntegrationsService(repository);

  beforeEach(() => {
    vi.clearAllMocks();
    selectSingleMock.mockResolvedValue({
      data: { role: 'admin', email: 'admin@alice.dev' },
      error: null,
    });
  });

  it('strips secrets when listing integrations for admins', async () => {
    listMock.mockResolvedValue([integrationRow]);

    const integrations = await service.listIntegrations('admin-1', {});

    expect(integrations).toHaveLength(1);
    expect(integrations[0]?.config).toEqual({
      kind: 'chat_model',
      model: 'gpt-4o',
      display_label: 'GPT-4o',
      has_api_key: true,
    });
    expect(integrations[0]?.config).not.toHaveProperty('api_key');
  });

  it('rejects non-admin integration list access', async () => {
    selectSingleMock.mockResolvedValue({
      data: { role: 'member', email: 'member@alice.dev' },
      error: null,
    });

    await expect(service.listIntegrations('member-1', {})).rejects.toThrow(
      'Unauthorized. Only administrators can manage integrations.'
    );
  });

  it('encrypts api_key on create', async () => {
    createMock.mockImplementation(async (data) => ({
      ...integrationRow,
      config: data.config,
    }));

    await service.createIntegration('admin-1', {
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
    });

    const createArg = createMock.mock.calls[0]?.[0];
    expect(createArg.config).toMatchObject({
      kind: 'chat_model',
      api_key: expect.stringMatching(/^v1:/),
    });
  });

  it('maps active chat models without secrets for authenticated users', async () => {
    selectSingleMock.mockResolvedValue({
      data: { role: 'member', email: 'member@alice.dev' },
      error: null,
    });
    listActiveChatModelsMock.mockResolvedValue([integrationRow]);

    const models = await service.listChatModels('member-1');

    expect(models).toEqual([
      {
        id: integrationRow.id,
        provider: 'openai',
        name: 'GPT-4o',
        is_default: false,
        model: 'gpt-4o',
        display_label: 'GPT-4o',
      },
    ]);
  });

  it('preserves existing secrets when patch omits api_key', async () => {
    findByIdMock.mockResolvedValue(integrationRow);
    updateMock.mockImplementation(async (data) => ({
      ...integrationRow,
      name: data.name ?? integrationRow.name,
      config: data.config ?? integrationRow.config,
    }));

    await service.patchIntegration('admin-1', integrationRow.id, {
      name: 'GPT-4o (prod)',
      config: {
        kind: 'chat_model',
        display_label: 'GPT-4o (prod)',
      },
    });

    const updateArg = updateMock.mock.calls[0]?.[0];
    expect(updateArg.config).toMatchObject({
      kind: 'chat_model',
      display_label: 'GPT-4o (prod)',
      api_key: 'v1:encrypted',
    });
  });
});

describe('IntegrationsService.resolveChatModelForChat', () => {
  const service = new IntegrationsService(repository);

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.GEMINI_API_KEY;
    findDefaultActiveChatModelMock.mockResolvedValue(null);
  });

  it('resolves an active integration by id and decrypts api_key', async () => {
    findActiveChatModelByIdMock.mockResolvedValue({
      ...integrationRow,
      config: {
        kind: 'chat_model',
        model: 'gpt-4o',
        display_label: 'GPT-4o',
        api_key: 'sk-test',
      },
    });

    const config = await service.resolveChatModelForChat({
      integrationId: integrationRow.id,
    });

    expect(config).toMatchObject({
      integrationId: integrationRow.id,
      provider: 'openai',
      model: 'gpt-4o',
      apiKey: 'sk-test',
      apiUrl: 'https://api.openai.com/v1/chat/completions',
    });
  });

  it('falls back to GEMINI_API_KEY when no integration row exists', async () => {
    process.env.GEMINI_API_KEY = 'legacy-key';

    const config = await service.resolveChatModelForChat({});

    expect(config).toMatchObject({
      integrationId: null,
      provider: 'gemini',
      apiKey: 'legacy-key',
    });
  });

  it('throws when no integration or env fallback is available', async () => {
    await expect(service.resolveChatModelForChat({})).rejects.toThrow(
      'No chat model configured'
    );
  });
});
