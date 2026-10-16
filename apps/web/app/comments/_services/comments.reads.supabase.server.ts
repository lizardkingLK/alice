import {
  USER_PROJECTION_WITH_ROLE,
  WORK_ITEM_ASSIGNEE_POSTGREST_SELECT,
  projectRelationSelect,
  userRelationSelect,
} from '@repo/types';
import { createClient } from '@/lib/supabase/server';
import {
  aggregateCountsByKey,
  throwIfError,
  zeroCountsById,
} from '@/lib/db/query';
import { mapCommentWorkItemOption } from './comments.mutations.shared';
import type {
  CommentItem,
  CommentWorkItemOption,
  CommentWorkItemOptionRow,
} from './comments.mutations.shared';

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
export async function listCommentsFromSupabase(
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

const COMMENT_WORK_ITEM_OPTION_SELECT = `
  id, title, type, project_id, jira_issue_key, priority, description,
  ${projectRelationSelect()},
  ${WORK_ITEM_ASSIGNEE_POSTGREST_SELECT}
`;

/** Work-item options for the comments compose/filter dropdown (direct RSC read). */
export async function listCommentWorkItemOptions(
  limit = 50,
  options?: { projectId?: string }
): Promise<CommentWorkItemOption[]> {
  const supabase = await createClient();

  let query = supabase
    .from('work_items')
    .select(COMMENT_WORK_ITEM_OPTION_SELECT)
    .eq('record_status', 'active')
    .limit(limit);

  if (options?.projectId) {
    query = query.eq('project_id', options.projectId);
  }

  const { data, error } = await query;

  throwIfError(
    error,
    'failed to list work items for comments',
    'Failed to retrieve work items for comments'
  );

  return ((data ?? []) as unknown as CommentWorkItemOptionRow[]).map(
    mapCommentWorkItemOption
  );
}

/**
 * Active comment counts (including replies) keyed by work item id.
 * Used by the parent details subtasks list — one batched read, no N+1.
 */
export async function getCommentCountsByWorkItemIds(
  workItemIds: readonly string[]
): Promise<Record<string, number>> {
  const counts = zeroCountsById(workItemIds);
  if (workItemIds.length === 0) {
    return counts;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('comments')
    .select('work_item_id')
    .in('work_item_id', [...workItemIds])
    .eq('status', 'active');

  throwIfError(
    error,
    'failed to count comments by work item',
    'Failed to retrieve comment counts'
  );

  return aggregateCountsByKey(
    counts,
    (data ?? []).map((row) => row.work_item_id)
  );
}
