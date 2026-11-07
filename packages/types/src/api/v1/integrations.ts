import { z } from 'zod';
import {
  IntegrationCategory as IntegrationCategoryEnum,
  IntegrationScope as IntegrationScopeEnum,
  IntegrationStatus as IntegrationStatusEnum,
} from '../../generated/prisma/enums.js';
import type { integrationsGetPayload } from '../../generated/prisma/models/integrations.js';
import {
  integrationConfigPatchSchema,
  integrationConfigPublicSchema,
  integrationConfigStoredSchema,
  integrationIdentityValidationMessage,
} from '../../integrations/config.js';
import { emptyToUndefined } from './query-preprocess.js';

type IntegrationCategoryType =
  (typeof IntegrationCategoryEnum)[keyof typeof IntegrationCategoryEnum];
type IntegrationScopeType =
  (typeof IntegrationScopeEnum)[keyof typeof IntegrationScopeEnum];
type IntegrationStatusType =
  (typeof IntegrationStatusEnum)[keyof typeof IntegrationStatusEnum];

const integrationCategorySchema = z.enum(
  Object.values(IntegrationCategoryEnum) as [
    IntegrationCategoryType,
    ...IntegrationCategoryType[],
  ]
);

const integrationScopeSchema = z.enum(
  Object.values(IntegrationScopeEnum) as [
    IntegrationScopeType,
    ...IntegrationScopeType[],
  ]
);

const integrationStatusSchema = z.enum(
  Object.values(IntegrationStatusEnum) as [
    IntegrationStatusType,
    ...IntegrationStatusType[],
  ]
);

export const integrationListSelect = {
  id: true,
  catalog_id: true,
  category: true,
  scope: true,
  project_id: true,
  provider: true,
  name: true,
  status: true,
  config: true,
  is_default: true,
  sort_order: true,
  created_at: true,
  updated_at: true,
  created_by: true,
  created_by_user: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
} as const;

export const integrationDetailSelect = {
  ...integrationListSelect,
  updated_by: true,
} as const;

export type IntegrationListRow = integrationsGetPayload<{
  select: typeof integrationListSelect;
}>;

export type IntegrationDetailRow = integrationsGetPayload<{
  select: typeof integrationDetailSelect;
}>;

export const listIntegrationsQuerySchema = z.object({
  category: z.preprocess(
    emptyToUndefined,
    integrationCategorySchema.optional()
  ),
  scope: z.preprocess(emptyToUndefined, integrationScopeSchema.optional()),
  status: z.preprocess(emptyToUndefined, integrationStatusSchema.optional()),
  catalog_id: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
});

export type ListIntegrationsQuery = z.infer<typeof listIntegrationsQuerySchema>;

export const createIntegrationBodySchema = z
  .object({
    catalog_id: z.string().min(1),
    category: integrationCategorySchema,
    provider: z.string().min(1),
    name: z.string().min(1),
    status: integrationStatusSchema.optional(),
    config: integrationConfigStoredSchema,
    is_default: z.boolean().optional(),
    sort_order: z.coerce.number().int().optional(),
    scope: integrationScopeSchema.optional(),
    project_id: z.uuid().optional(),
  })
  .superRefine((body, context) => {
    const message = integrationIdentityValidationMessage({
      catalogId: body.catalog_id,
      category: body.category,
      provider: body.provider,
      configKind: body.config.kind,
    });
    if (message) {
      context.addIssue({
        code: 'custom',
        message,
        path: ['catalog_id'],
      });
    }

    const scope = body.scope ?? 'organization';
    if (scope === 'member') {
      context.addIssue({
        code: 'custom',
        message: 'Member-scoped integrations are not supported yet.',
        path: ['scope'],
      });
      return;
    }

    if (scope === 'project') {
      if (!body.project_id) {
        context.addIssue({
          code: 'custom',
          message: 'project_id is required when scope is project.',
          path: ['project_id'],
        });
      }
      if (body.category !== 'ai_agent') {
        context.addIssue({
          code: 'custom',
          message: 'Only AI agent integrations may be project-scoped.',
          path: ['category'],
        });
      }
      return;
    }

    if (body.project_id) {
      context.addIssue({
        code: 'custom',
        message: 'project_id is only allowed when scope is project.',
        path: ['project_id'],
      });
    }
  });

export type CreateIntegrationBody = z.infer<typeof createIntegrationBodySchema>;

export const patchIntegrationBodySchema = z
  .object({
    catalog_id: z.string().min(1).optional(),
    category: integrationCategorySchema.optional(),
    provider: z.string().min(1).optional(),
    name: z.string().min(1).optional(),
    status: integrationStatusSchema.optional(),
    config: integrationConfigPatchSchema.optional(),
    is_default: z.boolean().optional(),
    sort_order: z.coerce.number().int().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: 'At least one field is required.',
  });

export type PatchIntegrationBody = z.infer<typeof patchIntegrationBodySchema>;

/** Admin list/detail wire row — `config` secrets already stripped. */
export const integrationWireSchema = z.object({
  id: z.uuid(),
  catalog_id: z.string(),
  category: integrationCategorySchema,
  scope: integrationScopeSchema,
  project_id: z.uuid().nullable(),
  provider: z.string(),
  name: z.string(),
  status: integrationStatusSchema,
  config: integrationConfigPublicSchema,
  is_default: z.boolean(),
  sort_order: z.number().int(),
  created_by: z.uuid().nullable(),
  created_by_name: z.string().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
});

export type IntegrationWire = z.infer<typeof integrationWireSchema>;

export const integrationDetailWireSchema = integrationWireSchema.extend({
  updated_by: z.uuid().nullable(),
});

export type IntegrationDetailWire = z.infer<typeof integrationDetailWireSchema>;

/** Active chat models for the Alice Chat dropdown (no secrets). */
export const chatModelOptionSchema = z.object({
  id: z.uuid(),
  provider: z.string(),
  name: z.string(),
  is_default: z.boolean(),
  model: z.string(),
  display_label: z.string(),
  model_version: z.string().optional(),
  scope: integrationScopeSchema.optional(),
  project_id: z.uuid().nullable().optional(),
  created_by: z.uuid().nullable().optional(),
  created_by_name: z.string().nullable().optional(),
});

export type ChatModelOption = z.infer<typeof chatModelOptionSchema>;

export const chatModelOptionsResponseSchema = z.object({
  models: z.array(chatModelOptionSchema),
});

export type ChatModelOptionsResponse = z.infer<
  typeof chatModelOptionsResponseSchema
>;

/** Org + project-scoped AI models available on a project Integrations tab. */
export const projectAiModelOptionSchema = chatModelOptionSchema.extend({
  catalog_id: z.string(),
  scope: integrationScopeSchema,
  project_id: z.uuid().nullable(),
  created_by: z.uuid().nullable(),
  created_by_name: z.string().nullable(),
  has_api_key: z.boolean(),
});

export type ProjectAiModelOption = z.infer<typeof projectAiModelOptionSchema>;

export const projectAiModelsResponseSchema = z.object({
  models: z.array(projectAiModelOptionSchema),
});

export type ProjectAiModelsResponse = z.infer<
  typeof projectAiModelsResponseSchema
>;

/** One org AI integration bound (or to bind) for a project. */
export const projectIntegrationBindingItemSchema = z.object({
  integration_id: z.uuid(),
  is_default_for_project: z.boolean().default(false),
});

export type ProjectIntegrationBindingItem = z.infer<
  typeof projectIntegrationBindingItemSchema
>;

function refineUniqueBindingIds(
  bindings: readonly ProjectIntegrationBindingItem[],
  context: z.RefinementCtx
): void {
  const seen = new Set<string>();
  for (const [index, binding] of bindings.entries()) {
    if (seen.has(binding.integration_id)) {
      context.addIssue({
        code: 'custom',
        message: 'Duplicate integration_id in bindings.',
        path: ['bindings', index, 'integration_id'],
      });
      return;
    }
    seen.add(binding.integration_id);
  }

  const defaults = bindings.filter((row) => row.is_default_for_project);
  if (defaults.length > 1) {
    context.addIssue({
      code: 'custom',
      message: 'At most one binding may be the project default.',
      path: ['bindings'],
    });
  }
}

/** Full replace of a project's AI model bindings (empty ⇒ fall through to org). */
export const putProjectIntegrationBindingsBodySchema = z
  .object({
    bindings: z.array(projectIntegrationBindingItemSchema),
  })
  .superRefine((body, context) => {
    refineUniqueBindingIds(body.bindings, context);
  });

export type PutProjectIntegrationBindingsBody = z.infer<
  typeof putProjectIntegrationBindingsBodySchema
>;

export const projectIntegrationBindingWireSchema = z.object({
  integration_id: z.uuid(),
  is_default_for_project: z.boolean(),
  integration: chatModelOptionSchema,
});

export type ProjectIntegrationBindingWire = z.infer<
  typeof projectIntegrationBindingWireSchema
>;

export const projectIntegrationBindingsResponseSchema = z.object({
  bindings: z.array(projectIntegrationBindingWireSchema),
});

export type ProjectIntegrationBindingsResponse = z.infer<
  typeof projectIntegrationBindingsResponseSchema
>;

/** Member preferred org chat model (bind-by-reference; null ⇒ workspace default). */
export const memberChatModelPreferenceWireSchema = z.object({
  default_integration_id: z.uuid().nullable(),
});

export type MemberChatModelPreferenceWire = z.infer<
  typeof memberChatModelPreferenceWireSchema
>;

export const memberChatModelPreferenceResponseSchema = z.object({
  preference: memberChatModelPreferenceWireSchema,
});

export type MemberChatModelPreferenceResponse = z.infer<
  typeof memberChatModelPreferenceResponseSchema
>;

export const putMemberChatModelPreferenceBodySchema = z.object({
  default_integration_id: z.uuid().nullable(),
});

export type PutMemberChatModelPreferenceBody = z.infer<
  typeof putMemberChatModelPreferenceBodySchema
>;
