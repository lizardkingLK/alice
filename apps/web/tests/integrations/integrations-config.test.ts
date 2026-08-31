import { describe, expect, it } from 'vitest';
import {
  createIntegrationBodySchema,
  integrationConfigPublicSchema,
  integrationConfigStoredSchema,
  patchIntegrationBodySchema,
  withoutIntegrationConfigSecrets,
} from '@repo/types';

describe('integrationConfigStoredSchema', () => {
  it('accepts a chat_model config with api_key', () => {
    const parsed = integrationConfigStoredSchema.parse({
      kind: 'chat_model',
      model: 'gpt-4o',
      display_label: 'GPT-4o',
      api_url: 'https://api.openai.com/v1/chat/completions',
      api_key: 'sk-test',
    });

    expect(parsed).toMatchObject({
      kind: 'chat_model',
      model: 'gpt-4o',
      display_label: 'GPT-4o',
    });
  });

  it('rejects chat_model config without model', () => {
    const result = integrationConfigStoredSchema.safeParse({
      kind: 'chat_model',
      display_label: 'GPT-4o',
    });
    expect(result.success).toBe(false);
  });
});

describe('withoutIntegrationConfigSecrets', () => {
  it('replaces api_key with has_api_key and drops ciphertext', () => {
    const publicConfig = withoutIntegrationConfigSecrets({
      kind: 'chat_model',
      model: 'gpt-4o',
      display_label: 'GPT-4o',
      api_key: 'v1:encrypted-blob',
    });

    expect(publicConfig).toEqual({
      kind: 'chat_model',
      model: 'gpt-4o',
      display_label: 'GPT-4o',
      has_api_key: true,
    });
    expect(integrationConfigPublicSchema.parse(publicConfig)).toEqual(
      publicConfig
    );
  });

  it('sets has_bot_token for slack configs', () => {
    const publicConfig = withoutIntegrationConfigSecrets({
      kind: 'slack_workspace',
      team_id: 'T01234567',
      team_name: 'Alice HQ',
      bot_token: 'xoxb-secret',
    });

    expect(publicConfig).toMatchObject({
      kind: 'slack_workspace',
      has_bot_token: true,
    });
    expect(publicConfig).not.toHaveProperty('bot_token');
  });

  it('returns empty object for non-object config', () => {
    expect(withoutIntegrationConfigSecrets(null)).toEqual({});
  });
});

describe('createIntegrationBodySchema', () => {
  it('accepts a valid create payload', () => {
    const parsed = createIntegrationBodySchema.parse({
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

    expect(parsed.catalog_id).toBe('openai');
    expect(parsed.category).toBe('ai_agent');
  });
});

describe('patchIntegrationBodySchema', () => {
  it('accepts partial config with omitted secrets', () => {
    const parsed = patchIntegrationBodySchema.parse({
      config: {
        kind: 'chat_model',
        display_label: 'GPT-4o (prod)',
      },
    });

    expect(parsed.config).toMatchObject({
      kind: 'chat_model',
      display_label: 'GPT-4o (prod)',
    });
  });

  it('rejects an empty patch body', () => {
    expect(patchIntegrationBodySchema.safeParse({}).success).toBe(false);
  });
});
