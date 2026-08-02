import {
  createTeamSchema,
  expectedUpdatedAtSchema,
  teamMemberPatchFields,
  updateTeamSchema as baseUpdateTeamSchema,
} from '@repo/types';
import { z } from 'zod';

export { createTeamSchema };

export const updateTeamSchema = baseUpdateTeamSchema.extend({
  expectedUpdatedAt: expectedUpdatedAtSchema,
});

export const updateTeamMemberSchema = z
  .object({
    ...teamMemberPatchFields,
    expectedUpdatedAt: expectedUpdatedAtSchema,
  })
  .refine((d) => d.capacity !== undefined || d.allocation !== undefined, {
    message: 'At least one of capacity or allocation must be provided.',
  });

/** Body for status-only mutations (soft-delete/restore) that still need the lock check. */
export const teamLockActionSchema = z.object({
  expectedUpdatedAt: expectedUpdatedAtSchema,
});
