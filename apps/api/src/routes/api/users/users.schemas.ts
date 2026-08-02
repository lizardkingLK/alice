import {
  createUserSchema,
  expectedUpdatedAtSchema,
  updateUserSchema as baseUpdateUserSchema,
} from '@repo/types';
import { z } from 'zod';

export { createUserSchema };

export const updateUserSchema = baseUpdateUserSchema.extend({
  expectedUpdatedAt: expectedUpdatedAtSchema,
});

export const toggleUserActiveSchema = z.object({
  active: z.boolean(),
  expectedUpdatedAt: expectedUpdatedAtSchema,
});
