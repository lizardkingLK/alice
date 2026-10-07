import {
  createSprintBodySchema,
  expectedUpdatedAtSchema,
  SPRINT_STATUSES,
} from '@repo/types';
import { z } from 'zod';

export { createSprintBodySchema };
export type { CreateSprintBody } from '@repo/types';

export const updateSprintStatusSchema = z.object({
  status: z.enum(SPRINT_STATUSES),
  expectedUpdatedAt: expectedUpdatedAtSchema,
});

export const updateSprintBodySchema = createSprintBodySchema.safeExtend({
  expectedUpdatedAt: expectedUpdatedAtSchema,
});

export type UpdateSprintBody = z.infer<typeof updateSprintBodySchema>;
