import { expectedUpdatedAtSchema } from '@repo/types';
import { z } from 'zod';

export const createCommentSchema = z.object({
  work_item_id: z.string().min(1, 'Work item ID is required'),
  content: z.string().min(1, 'Comment content cannot be empty'),
  parent_id: z.string().min(1).nullable().optional(),
});

export const updateCommentSchema = z.object({
  content: z.string().min(1, 'Comment content cannot be empty'),
  expectedUpdatedAt: expectedUpdatedAtSchema,
});

/** Body for status-only mutations (archive/restore) that still need the lock check. */
export const commentLockActionSchema = z.object({
  expectedUpdatedAt: expectedUpdatedAtSchema,
});
