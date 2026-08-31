import { z } from 'zod';
import type { commentsGetPayload } from '../../generated/prisma/models/comments.js';
import {
  emptyToUndefined,
  paginatedListLimitField,
  paginatedListPageField,
} from './query-preprocess.js';

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

const optionalUuid = z.preprocess(emptyToUndefined, z.uuid().optional());

export const listCommentsQuerySchema = z
  .object({
    page: paginatedListPageField,
    limit: paginatedListLimitField(),
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
