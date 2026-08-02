export { createProjectSchema } from '@repo/types';
import {
  expectedUpdatedAtSchema,
  updateProjectSchema as baseUpdateProjectSchema,
} from '@repo/types';
import { z } from 'zod';

export const updateProjectSchema = baseUpdateProjectSchema.extend({
  expectedUpdatedAt: expectedUpdatedAtSchema,
});

/** Body for status-only mutations (soft-delete/restore) that still need the lock check. */
export const projectLockActionSchema = z.object({
  expectedUpdatedAt: expectedUpdatedAtSchema,
});
