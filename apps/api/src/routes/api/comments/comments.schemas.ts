import {
  expectedUpdatedAtSchema,
  isValidCommentDoc,
  type Json,
} from '@repo/types';
import { z } from 'zod';

/** Reaction toggle — merge semantics, no optimistic lock. */
export { toggleCommentReactionSchema as toggleCommentReactionBodySchema } from '@repo/types';

const commentContentSchema = z.custom<Json>(
  (value) => isValidCommentDoc(value),
  {
    message: 'Comment content cannot be empty',
  }
);

export const createCommentSchema = z.object({
  work_item_id: z.uuid('Work item ID must be a valid UUID'),
  content: commentContentSchema,
  parent_id: z
    .uuid('Parent comment ID must be a valid UUID')
    .nullable()
    .optional(),
});

export const updateCommentSchema = z.object({
  content: commentContentSchema,
  expectedUpdatedAt: expectedUpdatedAtSchema,
});

/** Body for status-only mutations (archive/restore) that still need the lock check. */
export const commentLockActionSchema = z.object({
  expectedUpdatedAt: expectedUpdatedAtSchema,
});
