import { apiFetch } from '@/lib/api/api-client.server';
import { createCommentsService } from './comments.service.base';
import type { CommentItem } from './comments.service.base';
import { getUser } from '@/lib/auth';
import { safeServerFetch } from '@/lib/safe-server-fetch';

const service = createCommentsService(apiFetch);

/** M4.3 — server reader for work-item discussion threads (no client mount fetch). */
export async function getWorkItemDiscussion(
  workItemId: string
): Promise<CommentItem[]> {
  const user = await getUser();
  if (!user) {
    return [];
  }

  return safeServerFetch(
    service.getCommentsList(workItemId),
    [],
    `fetch discussion for work item ${workItemId}`
  );
}

export const createComment = service.createComment;
export const updateComment = service.updateComment;
export const archiveComment = service.archiveComment;
export const restoreComment = service.restoreComment;
