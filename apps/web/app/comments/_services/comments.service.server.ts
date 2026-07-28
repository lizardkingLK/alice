import {
  USER_PROJECTION_WITH_ROLE,
  projectRelationSelect,
  userRelationSelect,
} from '@repo/types';
import { apiFetch } from '@/lib/api/api-client.server';
import { createClient } from '@/lib/supabase/server';
import { getUser } from '@/lib/auth';
import { safeServerFetch } from '@/lib/safe-server-fetch';
import { throwIfError } from '@/lib/db/query';
import {
  createCommentsService,
  mapCommentWorkItemOption,
} from './comments.service.base';
import type {
  CommentItem,
  CommentWorkItemOption,
  CommentWorkItemOptionRow,
} from './comments.service.base';

const service = createCommentsService(apiFetch);

const COMMENT_AUTHOR_SELECT = userRelationSelect(
  'author',
  'comments_author_id_fkey',
  USER_PROJECTION_WITH_ROLE
);

const COMMENT_LIST_SELECT = `
  *,
  ${COMMENT_AUTHOR_SELECT},
  work_item:work_items(id, title, type, ${projectRelationSelect()})
`;

/**
 * Direct Supabase read for comments (PERFORMANCE.md M1).
 * Optional `workItemId` scopes to a single discussion thread.
 */
export async function listComments(
  workItemId?: string
): Promise<CommentItem[]> {
  const supabase = await createClient();

  let query = supabase
    .from('comments')
    .select(COMMENT_LIST_SELECT)
    .order('created_at', { ascending: false });

  if (workItemId) {
    query = query.eq('work_item_id', workItemId);
  }

  const { data, error } = await query;
  throwIfError(
    error,
    'failed to list comments',
    'Failed to retrieve comments list'
  );

  return (data ?? []) as unknown as CommentItem[];
}

/** Work-item options for the comments compose/filter dropdown (direct RSC read). */
export async function listCommentWorkItemOptions(
  limit = 50
): Promise<CommentWorkItemOption[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('work_items')
    .select(`id, title, type, project_id, ${projectRelationSelect()}`)
    .limit(limit);

  throwIfError(
    error,
    'failed to list work items for comments',
    'Failed to retrieve work items for comments'
  );

  return ((data ?? []) as unknown as CommentWorkItemOptionRow[]).map(
    mapCommentWorkItemOption
  );
}

/** M4.3 — work-item discussion thread via direct RSC read (no Express hop). */
export async function getWorkItemDiscussion(
  workItemId: string
): Promise<CommentItem[]> {
  const user = await getUser();
  if (!user) {
    return [];
  }

  return safeServerFetch(
    listComments(workItemId),
    [],
    `fetch discussion for work item ${workItemId}`
  );
}

export const createComment = service.createComment;
export const updateComment = service.updateComment;
export const archiveComment = service.archiveComment;
export const restoreComment = service.restoreComment;
