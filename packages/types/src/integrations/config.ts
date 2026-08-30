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
]);

export type IntegrationConfigKind = z.infer<typeof integrationKindSchema>;

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
  api_url: z.string().min(1).optional(),
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

/** Stored integration `config` JSONB (may include plaintext or `v1:` ciphertext). */
export const integrationConfigStoredSchema = z.discriminatedUnion('kind', [
  chatModelConfigStoredSchema,
  slackWorkspaceConfigStoredSchema,
  figmaOAuthConfigStoredSchema,
]);

/** API-facing config after secret stripping. */
export const integrationConfigPublicSchema = z.discriminatedUnion('kind', [
  chatModelConfigPublicSchema,
  slackWorkspaceConfigPublicSchema,
  figmaOAuthConfigPublicSchema,
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
