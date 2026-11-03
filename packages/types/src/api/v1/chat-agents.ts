import { z } from 'zod';
import { Constants } from '../../generated/supabase/database.types.js';
import { ChatAgentAutonomy as ChatAgentAutonomyEnum } from '../../generated/prisma/enums.js';
import type { chat_agentsGetPayload } from '../../generated/prisma/models/chat_agents.js';
import { emptyToUndefined } from './query-preprocess.js';

type ChatAgentAutonomyType =
  (typeof ChatAgentAutonomyEnum)[keyof typeof ChatAgentAutonomyEnum];

const chatAgentAutonomySchema = z.enum(
  Object.values(ChatAgentAutonomyEnum) as [
    ChatAgentAutonomyType,
    ...ChatAgentAutonomyType[],
  ]
);

const recordStatusSchema = z.enum(Constants.public.Enums.RecordStatus);

export const chatAgentListSelect = {
  id: true,
  key: true,
  owner_id: true,
  name: true,
  title: true,
  description: true,
  autonomy: true,
  status: true,
  version: true,
  forked_from_id: true,
  is_default: true,
  tagline: true,
  avatar_style: true,
  avatar_seed: true,
  created_by: true,
  created_at: true,
  updated_by: true,
  updated_at: true,
} as const;

export const chatAgentDetailSelect = {
  ...chatAgentListSelect,
  instructions: true,
} as const;

export type ChatAgentListRow = chat_agentsGetPayload<{
  select: typeof chatAgentListSelect;
}>;

export type ChatAgentDetailRow = chat_agentsGetPayload<{
  select: typeof chatAgentDetailSelect;
}>;

export const listChatAgentsQuerySchema = z.object({
  status: z.preprocess(
    emptyToUndefined,
    z.enum(['active', 'archived']).optional()
  ),
});

export type ListChatAgentsQuery = z.infer<typeof listChatAgentsQuerySchema>;

export const patchChatAgentBodySchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    title: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().max(2000).optional(),
    instructions: z.string().trim().min(1).max(100_000).optional(),
    autonomy: chatAgentAutonomySchema.optional(),
    status: z.enum(['active', 'archived']).optional(),
    tagline: z.string().trim().max(500).optional(),
    avatarStyle: z.string().trim().min(1).max(64).optional(),
    avatarSeed: z.string().trim().min(1).max(120).optional(),
    enabledTools: z
      .array(
        z.object({
          key: z.string().trim().min(1),
          enabled: z.boolean(),
        })
      )
      .optional(),
    enabledSkills: z
      .array(
        z.object({
          key: z.string().trim().min(1),
          enabled: z.boolean(),
        })
      )
      .optional(),
  })
  .refine(
    (body) => Object.keys(body).length > 0,
    'At least one field is required'
  );

export type PatchChatAgentBody = z.infer<typeof patchChatAgentBodySchema>;

/** Gallery / list wire (no instructions). */
export const chatAgentSummaryWireSchema = z.object({
  id: z.uuid(),
  key: z.string().nullable(),
  ownerId: z.uuid().nullable(),
  name: z.string(),
  title: z.string(),
  description: z.string(),
  autonomy: chatAgentAutonomySchema,
  status: recordStatusSchema,
  version: z.number().int(),
  forkedFromId: z.uuid().nullable(),
  isDefault: z.boolean(),
  tagline: z.string(),
  avatarStyle: z.string(),
  avatarSeed: z.string(),
  kind: z.enum(['system', 'personal']),
  enabledToolKeys: z.array(z.string()),
  enabledSkillKeys: z.array(z.string()),
  createdBy: z.uuid().nullable(),
  createdAt: z.string(),
  updatedBy: z.uuid().nullable(),
  updatedAt: z.string(),
});

export type ChatAgentSummaryWire = z.infer<typeof chatAgentSummaryWireSchema>;

/** Detail / mutate wire (decrypted instructions). */
export const chatAgentDetailWireSchema = chatAgentSummaryWireSchema.extend({
  instructions: z.string(),
});

export type ChatAgentDetailWire = z.infer<typeof chatAgentDetailWireSchema>;

export const chatToolCatalogWireSchema = z.object({
  id: z.uuid(),
  key: z.string(),
  label: z.string(),
  description: z.string(),
  sortOrder: z.number().int(),
  status: recordStatusSchema,
  hasInstruction: z.boolean(),
});

export type ChatToolCatalogWire = z.infer<typeof chatToolCatalogWireSchema>;

export const chatSkillCatalogWireSchema = z.object({
  id: z.uuid(),
  key: z.string(),
  label: z.string(),
  description: z.string(),
  sortOrder: z.number().int(),
  status: recordStatusSchema,
});

export type ChatSkillCatalogWire = z.infer<typeof chatSkillCatalogWireSchema>;

export { ChatAgentAutonomyEnum };
