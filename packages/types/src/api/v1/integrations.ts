import { z } from 'zod';
import {
  IntegrationCategory as IntegrationCategoryEnum,
  IntegrationStatus as IntegrationStatusEnum,
} from '../../generated/prisma/enums.js';
import type { integrationsGetPayload } from '../../generated/prisma/models/integrations.js';
import {
  integrationConfigPatchSchema,
  integrationConfigPublicSchema,
  integrationConfigStoredSchema,
} from '../../integrations/config.js';

type IntegrationCategoryType =
  (typeof IntegrationCategoryEnum)[keyof typeof IntegrationCategoryEnum];
type IntegrationStatusType =
  (typeof IntegrationStatusEnum)[keyof typeof IntegrationStatusEnum];

const integrationCategorySchema = z.enum(
  Object.values(IntegrationCategoryEnum) as [
    IntegrationCategoryType,
    ...IntegrationCategoryType[],
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
  provider: true,
  name: true,
  status: true,
  config: true,
  is_default: true,
  sort_order: true,
  created_at: true,
  updated_at: true,
} as const;

export const integrationDetailSelect = {
  ...integrationListSelect,
  created_by: true,
  updated_by: true,
} as const;

export type IntegrationListRow = integrationsGetPayload<{
  select: typeof integrationListSelect;
}>;

export type IntegrationDetailRow = integrationsGetPayload<{
  select: typeof integrationDetailSelect;
}>;

function emptyToUndefined(value: unknown): unknown {
  if (value === '' || value === undefined || value === null) {
    return undefined;
  }
  return value;
}

export const listIntegrationsQuerySchema = z.object({
  category: z.preprocess(
    emptyToUndefined,
    integrationCategorySchema.optional()
  ),
  status: z.preprocess(emptyToUndefined, integrationStatusSchema.optional()),
  catalog_id: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
});

export type ListIntegrationsQuery = z.infer<typeof listIntegrationsQuerySchema>;

export const createIntegrationBodySchema = z.object({
  catalog_id: z.string().min(1),
  category: integrationCategorySchema,
  provider: z.string().min(1),
  name: z.string().min(1),
  status: integrationStatusSchema.optional(),
  config: integrationConfigStoredSchema,
  is_default: z.boolean().optional(),
  sort_order: z.coerce.number().int().optional(),
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
  provider: z.string(),
  name: z.string(),
  status: integrationStatusSchema,
  config: integrationConfigPublicSchema,
  is_default: z.boolean(),
  sort_order: z.number().int(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
});

export type IntegrationWire = z.infer<typeof integrationWireSchema>;

export const integrationDetailWireSchema = integrationWireSchema.extend({
  created_by: z.uuid().nullable(),
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
});

export type ChatModelOption = z.infer<typeof chatModelOptionSchema>;

export const chatModelOptionsResponseSchema = z.object({
  models: z.array(chatModelOptionSchema),
});

export type ChatModelOptionsResponse = z.infer<
  typeof chatModelOptionsResponseSchema
>;
