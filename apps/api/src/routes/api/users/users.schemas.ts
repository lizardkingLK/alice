export { createUserSchema } from '@repo/types';
import {
  expectedUpdatedAtSchema,
  updateUserSchema as baseUpdateUserSchema,
} from '@repo/types';
import { z } from 'zod';

export const updateUserSchema = baseUpdateUserSchema.extend({
  expectedUpdatedAt: expectedUpdatedAtSchema,
});

export const toggleUserActiveSchema = z.object({
  active: z.boolean(),
  expectedUpdatedAt: expectedUpdatedAtSchema,
});
