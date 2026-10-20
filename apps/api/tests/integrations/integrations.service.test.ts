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

  it('allows manager integration list access', async () => {
    selectSingleMock.mockResolvedValue({
      data: { role: 'manager', email: 'manager@alice.dev' },
      error: null,
    });
    listMock.mockResolvedValue([integrationRow]);

    const integrations = await service.listIntegrations('manager-1', {});
    expect(integrations).toHaveLength(1);
  });

  it('allows managers to create and update provider configurations', async () => {
    selectSingleMock.mockResolvedValue({
      data: { role: 'manager', email: 'manager@alice.dev' },
      error: null,
    });
    createMock.mockImplementation(async (data) => ({
      ...integrationRow,
      config: data.config,
    }));
    findByIdMock.mockResolvedValue(integrationRow);
    updateMock.mockImplementation(async (data) => ({
      ...integrationRow,
      name: data.name ?? integrationRow.name,
      config: data.config ?? integrationRow.config,
    }));

    await service.createIntegration('manager-1', {
      catalog_id: 'anthropic',
      category: 'ai_agent',
      provider: 'anthropic',
      name: 'Claude Sonnet 4',
      status: 'active',
      config: {
        kind: 'chat_model',
        model: 'claude-sonnet-4-20250514',
        display_label: 'Claude Sonnet 4',
        api_key: 'sk-ant-test',
      },
    });
    await service.patchIntegration('manager-1', integrationRow.id, {
      name: 'GPT-4o Production',
    });

    expect(createMock).toHaveBeenCalledOnce();
    expect(updateMock).toHaveBeenCalledOnce();
  });

  it('rejects member integration list access', async () => {
    selectSingleMock.mockResolvedValue({
      data: { role: 'member', email: 'member@alice.dev' },
      error: null,
    });

    await expect(service.listIntegrations('member-1', {})).rejects.toThrow(
      'Unauthorized. Only admins and managers can manage integrations.'
    );
  });

  it('rejects member create and update access', async () => {
    selectSingleMock.mockResolvedValue({
      data: { role: 'member', email: 'member@alice.dev' },
      error: null,
    });

    await expect(
      service.createIntegration('member-1', {
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
      })
    ).rejects.toThrow(
      'Unauthorized. Only admins and managers can manage integrations.'
    );
    await expect(
      service.patchIntegration('member-1', integrationRow.id, {
        name: 'Forbidden update',
      })
    ).rejects.toThrow(
      'Unauthorized. Only admins and managers can manage integrations.'
    );
    expect(createMock).not.toHaveBeenCalled();
    expect(findByIdMock).not.toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
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

  it('keeps all supported active providers available to Alice Chat', async () => {
    selectSingleMock.mockResolvedValue({
      data: { role: 'member', email: 'member@alice.dev' },
      error: null,
    });
    const providerRows = [
      ['alice-gemini', 'gemini', 'gemini-3.6-flash', 'Gemini 3.6'],
      ['alice-spacexai', 'spacexai', 'grok-4.3', 'Grok 4.3'],
      ['openai', 'openai', 'gpt-4o', 'GPT-4o'],
      ['anthropic', 'anthropic', 'claude-sonnet-4-20250514', 'Claude Sonnet 4'],
    ].map(([catalogId, provider, model, displayLabel], index) => ({
      ...integrationRow,
      id: `${index + 1}1111111-1111-4111-8111-111111111111`,
      catalog_id: catalogId!,
      provider: provider!,
      name: displayLabel!,
      config: {
        kind: 'chat_model' as const,
        model: model!,
        display_label: displayLabel!,
        api_key: 'v1:encrypted',
      },
    }));
    listActiveChatModelsMock.mockResolvedValue(providerRows);

    const models = await service.listChatModels('member-1');

    expect(models.map((model) => model.provider)).toEqual([
      'gemini',
      'spacexai',
      'openai',
      'anthropic',
    ]);
    expect(models.every((model) => !('api_key' in model))).toBe(true);
  });

  it('keeps multiple models for one provider separate without exposing or replacing their keys', async () => {
    const secondOpenAiRow = {
      ...integrationRow,
      id: '22222222-2222-4222-8222-222222222222',
      name: 'GPT-4o mini',
      config: {
        kind: 'chat_model' as const,
        model: 'gpt-4o-mini',
        display_label: 'GPT-4o mini',
        api_key: 'v1:second-encrypted-key',
      },
      is_default: true,
      sort_order: 1,
    };
    listActiveChatModelsMock.mockResolvedValue([
      integrationRow,
      secondOpenAiRow,
    ]);
    findByIdMock.mockResolvedValue(secondOpenAiRow);
    updateMock.mockImplementation(async (data) => ({
      ...secondOpenAiRow,
      name: data.name ?? secondOpenAiRow.name,
      config: data.config ?? secondOpenAiRow.config,
    }));

    const models = await service.listChatModels('admin-1');
    const updated = await service.patchIntegration(
      'admin-1',
      secondOpenAiRow.id,
      {
        name: 'GPT-4o mini production',
        config: {
          kind: 'chat_model',
          display_label: 'GPT-4o mini production',
        },
      }
    );

    expect(models).toEqual([
      expect.objectContaining({
        id: integrationRow.id,
        provider: 'openai',
        model: 'gpt-4o',
        is_default: false,
      }),
      expect.objectContaining({
        id: secondOpenAiRow.id,
        provider: 'openai',
        model: 'gpt-4o-mini',
        is_default: true,
      }),
    ]);
    expect(models.every((model) => !('api_key' in model))).toBe(true);
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: secondOpenAiRow.id,
        config: expect.objectContaining({
          model: 'gpt-4o-mini',
          display_label: 'GPT-4o mini production',
          api_key: 'v1:second-encrypted-key',
        }),
      })
    );
    expect(updated.config).toMatchObject({
      model: 'gpt-4o-mini',
      display_label: 'GPT-4o mini production',
      has_api_key: true,
    });
    expect(updated.config).not.toHaveProperty('api_key');
    expect(integrationRow.config.api_key).toBe('v1:encrypted');
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

  it('rejects a patch that mismatches provider and catalog', async () => {
    findByIdMock.mockResolvedValue(integrationRow);

    await expect(
      service.patchIntegration('admin-1', integrationRow.id, {
        provider: 'anthropic',
      })
    ).rejects.toThrow(
      'Invalid integration configuration. Integration provider does not match its catalog.'
    );
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('rejects an unapproved API endpoint before storing credentials', async () => {
    await expect(
      service.createIntegration('admin-1', {
        catalog_id: 'openai',
        category: 'ai_agent',
        provider: 'openai',
        name: 'GPT-4o',
        config: {
          kind: 'chat_model',
          model: 'gpt-4o',
          display_label: 'GPT-4o',
          api_url:
            'https://evil.example/v1/chat/completions?api_key=sk-sensitive',
          api_key: 'sk-sensitive',
        },
      })
    ).rejects.toThrow(
      'Invalid integration configuration. The chat provider endpoint is not approved.'
    );
    expect(createMock).not.toHaveBeenCalled();
  });

  it('disables integrations through the repository', async () => {
    await service.deleteIntegration('admin-1', integrationRow.id);

    expect(disableMock).toHaveBeenCalledWith(integrationRow.id, 'admin-1');
  });
});

describe('IntegrationsService.resolveChatModelForChat', () => {
  const service = new IntegrationsService(repository);

  beforeEach(() => {
    vi.clearAllMocks();
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

  it('rejects an inactive integration selected by id without falling back to the default', async () => {
    findActiveChatModelByIdMock.mockResolvedValue(null);

    await expect(
      service.resolveChatModelForChat({ integrationId: integrationRow.id })
    ).rejects.toThrow('Chat model integration not found or inactive');

    expect(findActiveChatModelByIdMock).toHaveBeenCalledWith(integrationRow.id);
    expect(findDefaultActiveChatModelMock).not.toHaveBeenCalled();
  });

  it('uses the workspace default integration when integrationId is omitted', async () => {
    findDefaultActiveChatModelMock.mockResolvedValue({
      ...integrationRow,
      config: {
        kind: 'chat_model',
        model: 'gpt-4o',
        display_label: 'GPT-4o',
        api_key: 'sk-test',
      },
    });

    const config = await service.resolveChatModelForChat({});

    expect(config.integrationId).toBe(integrationRow.id);
    expect(config.model).toBe('gpt-4o');
  });

  it('rejects an unsafe endpoint from an existing integration without exposing it', async () => {
    findActiveChatModelByIdMock.mockResolvedValue({
      ...integrationRow,
      config: {
        kind: 'chat_model',
        model: 'gpt-4o',
        display_label: 'GPT-4o',
        api_key: 'sk-sensitive',
        api_url:
          'https://evil.example/v1/chat/completions?api_key=sk-sensitive',
      },
    });

    const promise = service.resolveChatModelForChat({
      integrationId: integrationRow.id,
    });

    await expect(promise).rejects.toThrow(
      'Invalid integration configuration. The chat provider endpoint is not approved.'
    );
    await expect(promise).rejects.not.toThrow(/evil\.example|sk-sensitive/);
  });

  it('throws when no integration is configured', async () => {
    await expect(service.resolveChatModelForChat({})).rejects.toThrow(
      'No chat model configured'
    );
  });
});
