import {
  expectedUpdatedAtSchema,
  isValidCommentDoc,
  type Json,
} from '@repo/types';
import { z } from 'zod';

const commentContentSchema = z.custom<Json>(
  (value) => isValidCommentDoc(value),
  {
    message: 'Comment content cannot be empty',
  }
);

export const createCommentSchema = z.object({
  work_item_id: z.string().min(1, 'Work item ID is required'),
  content: commentContentSchema,
  parent_id: z.string().min(1).nullable().optional(),
});

export const updateCommentSchema = z.object({
  content: commentContentSchema,
  expectedUpdatedAt: expectedUpdatedAtSchema,
});

/** Body for status-only mutations (archive/restore) that still need the lock check. */
export const commentLockActionSchema = z.object({
  expectedUpdatedAt: expectedUpdatedAtSchema,
});
