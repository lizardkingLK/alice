export { accessAllowlistCreateSchema } from '@repo/types';
import {
  accessAllowlistUpdateSchema as baseAccessAllowlistUpdateSchema,
  expectedUpdatedAtSchema,
} from '@repo/types';
import { z } from 'zod';

export const accessAllowlistUpdateSchema =
  baseAccessAllowlistUpdateSchema.extend({
    expectedUpdatedAt: expectedUpdatedAtSchema,
  });

/** Body for status-only mutations (soft-delete) that still need the lock check. */
export const accessAllowlistLockActionSchema = z.object({
  expectedUpdatedAt: expectedUpdatedAtSchema,
});
