import { z } from 'zod';
import type { commentsGetPayload } from '../../generated/prisma/models/comments.js';

export const commentAuthorSelect = {
  id: true,
  name: true,
  email: true,
  profile_picture: true,
} as const;

export const commentWorkItemProjectSelect = {
  id: true,
  name: true,
  key: true,
} as const;

export const commentWorkItemSelect = {
  id: true,
  title: true,
  type: true,
  project: { select: commentWorkItemProjectSelect },
} as const;

export const commentListSelect = {
  id: true,
  work_item_id: true,
  author_id: true,
  parent_id: true,
  content: true,
  edited: true,
  status: true,
  created_at: true,
  updated_at: true,
  author: { select: commentAuthorSelect },
  work_item: { select: commentWorkItemSelect },
} as const;

export const commentDetailSelect = commentListSelect;

export type CommentListRow = commentsGetPayload<{
  select: typeof commentListSelect;
}>;

export type CommentDetailRow = commentsGetPayload<{
  select: typeof commentDetailSelect;
}>;

function emptyToUndefined(value: unknown): unknown {
  if (value === '' || value === undefined || value === null) {
    return undefined;
  }
  return value;
}

const optionalUuid = z.preprocess(emptyToUndefined, z.uuid().optional());

export const listCommentsQuerySchema = z
  .object({
    page: z.preprocess(
      (value) => (value === undefined || value === '' ? 1 : value),
      z.coerce.number().int().min(1)
    ),
    limit: z.preprocess(
      (value) => (value === undefined || value === '' ? 10 : value),
      z.coerce.number().int().min(1).max(100)
    ),
    workItemId: optionalUuid,
  })
  .transform((query) => {
    return {
      page: query.page,
      limit: query.limit,
      workItemId: query.workItemId,
    };
  });

export type ListCommentsQuery = z.infer<typeof listCommentsQuerySchema>;
