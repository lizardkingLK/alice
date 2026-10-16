import { getUser } from '@/lib/auth';
import { apiFetch } from '@/lib/api/api-fetch.reads.use.server';
import { shouldReadViaApi } from '@/lib/data-retrieval.server';
import { safeServerFetch } from '@/lib/safe-server-fetch';
import { listCommentsFromApi } from './comments.reads.api.server';
import { listCommentsFromSupabase } from './comments.reads.supabase.server';
import { createCommentsService } from './comments.mutations.shared';
import type { CommentItem } from './comments.mutations.shared';

const service = createCommentsService(apiFetch);

/**
 * Public server read facade — picks supabase-js (default) or Express GET
 * based on `DATA_READS_VIA_API`. Optional `workItemId` scopes to one thread.
 */
export async function listComments(
  workItemId?: string
): Promise<CommentItem[]> {
  if (shouldReadViaApi('comments')) {
    return listCommentsFromApi(workItemId);
  }

  return listCommentsFromSupabase(workItemId);
}

/**
 * Dropdown work-item options and batched comment counts stay on Supabase
 * (not gated by `DATA_READS_VIA_API`).
 */
export {
  getCommentCountsByWorkItemIds,
  listCommentWorkItemOptions,
} from './comments.reads.supabase.server';

/** Work-item discussion thread — follows the `comments` read toggle. */
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
