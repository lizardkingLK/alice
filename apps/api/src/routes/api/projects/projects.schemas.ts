export { createProjectSchema } from '@repo/types';
import {
  expectedUpdatedAtSchema,
  updateProjectSchema as baseUpdateProjectSchema,
  workflowConfigEnvelopeSchema,
} from '@repo/types';
import { z } from 'zod';

export const updateProjectSchema = baseUpdateProjectSchema.extend({
  expectedUpdatedAt: expectedUpdatedAtSchema,
});

/** Body for status-only mutations (soft-delete/restore) that still need the lock check. */
export const projectLockActionSchema = z.object({
  expectedUpdatedAt: expectedUpdatedAtSchema,
});

/** Replace (or seed) the multi-workflow envelope on `projects.workflow_config`. */
export const putWorkflowConfigSchema = z.object({
  expectedUpdatedAt: expectedUpdatedAtSchema,
  config: workflowConfigEnvelopeSchema,
});

export const forkWorkflowConfigSchema = z.object({
  expectedUpdatedAt: expectedUpdatedAtSchema,
  sourceWorkflowId: z.string().trim().min(1).optional(),
  title: z.string().trim().min(1).max(120).optional(),
  description: z.string().max(2000).optional(),
});

export const workflowIdParamActionSchema = z.object({
  expectedUpdatedAt: expectedUpdatedAtSchema,
});
