import { z } from 'zod';

/** JSONB secret field names — encrypted at rest by the API service layer. */
export const INTEGRATION_SECRET_KEYS = [
  'api_key',
  'bot_token',
  'access_token',
  'refresh_token',
] as const;

export type IntegrationSecretKey = (typeof INTEGRATION_SECRET_KEYS)[number];

export const integrationKindSchema = z.enum([
  'chat_model',
  'slack_workspace',
  'figma_oauth',
  'github_oauth',
]);

export type IntegrationConfigKind = z.infer<typeof integrationKindSchema>;

type IntegrationIdentityRule = {
  readonly category: string;
  readonly provider: string;
  readonly configKind: IntegrationConfigKind;
};

/**
 * Catalog identities accepted by the integration API.
 *
 * Keep this server-enforced mapping aligned with the static Settings catalog.
 * It prevents a caller from pairing a trusted catalog id with a different
 * provider, category, or secret-bearing config shape.
 */
const INTEGRATION_IDENTITY_RULES: Readonly<
  Record<string, IntegrationIdentityRule>
> = {
  'alice-gemini': {
    category: 'ai_agent',
    provider: 'gemini',
    configKind: 'chat_model',
  },
  'alice-spacexai': {
    category: 'ai_agent',
    provider: 'spacexai',
    configKind: 'chat_model',
  },
  openai: {
    category: 'ai_agent',
    provider: 'openai',
    configKind: 'chat_model',
  },
  anthropic: {
    category: 'ai_agent',
    provider: 'anthropic',
    configKind: 'chat_model',
  },
  slack: {
    category: 'communication',
    provider: 'slack',
    configKind: 'slack_workspace',
  },
  figma: {
    category: 'design',
    provider: 'figma',
    configKind: 'figma_oauth',
  },
  github: {
    category: 'productivity',
    provider: 'github',
    configKind: 'github_oauth',
  },
};

export type IntegrationIdentityInput = {
  readonly catalogId: string;
  readonly category: string;
  readonly provider: string;
  readonly configKind: string;
};

/** Returns a safe validation message without echoing any credential data. */
export function integrationIdentityValidationMessage(
  input: IntegrationIdentityInput
): string | null {
  const rule = INTEGRATION_IDENTITY_RULES[input.catalogId];
  if (!rule) {
    return 'Unsupported integration catalog.';
  }
  if (rule.category !== input.category) {
    return 'Integration category does not match its catalog.';
  }
  if (rule.provider !== input.provider) {
    return 'Integration provider does not match its catalog.';
  }
  if (rule.configKind !== input.configKind) {
    return 'Integration configuration kind does not match its catalog.';
  }
  return null;
}

/** Maps a secret key to its public `has_*` boolean field name. */
export function integrationSecretHasKey(
  key: IntegrationSecretKey
): `has_${IntegrationSecretKey}` {
  return `has_${key}`;
}

const chatModelConfigStoredSchema = z.object({
  kind: z.literal('chat_model'),
  model: z.string().min(1),
  model_version: z.string().optional(),
  display_label: z.string().min(1),
  api_url: z.url().optional(),
  api_key: z.string().min(1).optional(),
});

const chatModelConfigPublicSchema = chatModelConfigStoredSchema
  .omit({ api_key: true })
  .extend({
    has_api_key: z.boolean().optional(),
  });

const slackWorkspaceConfigStoredSchema = z.object({
  kind: z.literal('slack_workspace'),
  team_id: z.string().min(1),
  team_name: z.string().min(1),
  default_channel_id: z.string().min(1).optional(),
  bot_token: z.string().min(1).optional(),
});

const slackWorkspaceConfigPublicSchema = slackWorkspaceConfigStoredSchema
  .omit({ bot_token: true })
  .extend({
    has_bot_token: z.boolean().optional(),
  });

const figmaOAuthConfigStoredSchema = z.object({
  kind: z.literal('figma_oauth'),
  access_token: z.string().min(1).optional(),
  refresh_token: z.string().min(1).optional(),
  expires_at: z.string().optional(),
});

const figmaOAuthConfigPublicSchema = figmaOAuthConfigStoredSchema
  .omit({ access_token: true, refresh_token: true })
  .extend({
    has_access_token: z.boolean().optional(),
    has_refresh_token: z.boolean().optional(),
  });

const githubOAuthConfigStoredSchema = z.object({
  kind: z.literal('github_oauth'),
  access_token: z.string().min(1).optional(),
  refresh_token: z.string().min(1).optional(),
  expires_at: z.string().optional(),
  scope: z.string().optional(),
  account_login: z.string().optional(),
  account_id: z.union([z.string(), z.number()]).optional(),
  account_name: z.string().optional(),
  account_avatar_url: z.string().optional(),
});

const githubOAuthConfigPublicSchema = githubOAuthConfigStoredSchema
  .omit({ access_token: true, refresh_token: true })
  .extend({
    has_access_token: z.boolean().optional(),
    has_refresh_token: z.boolean().optional(),
  });

/** Stored integration `config` JSONB (may include plaintext or `v1:` ciphertext). */
export const integrationConfigStoredSchema = z.discriminatedUnion('kind', [
  chatModelConfigStoredSchema,
  slackWorkspaceConfigStoredSchema,
  figmaOAuthConfigStoredSchema,
  githubOAuthConfigStoredSchema,
]);

/** API-facing config after secret stripping. */
export const integrationConfigPublicSchema = z.discriminatedUnion('kind', [
  chatModelConfigPublicSchema,
  slackWorkspaceConfigPublicSchema,
  figmaOAuthConfigPublicSchema,
  githubOAuthConfigPublicSchema,
]);

export type IntegrationConfigStored = z.infer<
  typeof integrationConfigStoredSchema
>;
export type IntegrationConfigPublic = z.infer<
  typeof integrationConfigPublicSchema
>;

/** Partial config updates — omit secret fields to leave ciphertext unchanged. */
export const integrationConfigPatchSchema = z.discriminatedUnion('kind', [
  chatModelConfigStoredSchema.partial().extend({
    kind: z.literal('chat_model'),
  }),
  slackWorkspaceConfigStoredSchema.partial().extend({
    kind: z.literal('slack_workspace'),
  }),
  figmaOAuthConfigStoredSchema.partial().extend({
    kind: z.literal('figma_oauth'),
  }),
  githubOAuthConfigStoredSchema.partial().extend({
    kind: z.literal('github_oauth'),
  }),
]);

export type IntegrationConfigPatch = z.infer<
  typeof integrationConfigPatchSchema
>;

export function isPlainRecord(
  value: unknown
): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Replace secret strings with `has_*` booleans for JSON responses.
 * Never returns `v1:` ciphertext blobs to clients.
 */
export function withoutIntegrationConfigSecrets(
  config: unknown
): IntegrationConfigPublic | Record<string, never> {
  if (!isPlainRecord(config)) {
    return {};
  }

  const publicConfig: Record<string, unknown> = { ...config };

  for (const secretKey of INTEGRATION_SECRET_KEYS) {
    const value = publicConfig[secretKey];
    if (typeof value === 'string' && value.length > 0) {
      publicConfig[integrationSecretHasKey(secretKey)] = true;
    }
    delete publicConfig[secretKey];
  }

  const parsed = integrationConfigPublicSchema.safeParse(publicConfig);
  if (parsed.success) {
    return parsed.data;
  }

  return publicConfig as IntegrationConfigPublic;
}

export function parseIntegrationConfigStored(
  config: unknown
): IntegrationConfigStored {
  return integrationConfigStoredSchema.parse(config);
}

export function parseIntegrationConfigPublic(
  config: unknown
): IntegrationConfigPublic {
  return integrationConfigPublicSchema.parse(config);
}
