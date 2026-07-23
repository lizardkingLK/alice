import { createClient } from '@/lib/supabase/server';
import { getUser } from '@/lib/auth';
import { safeServerFetch } from '@/lib/safe-server-fetch';
import {
  COMMENT_SELECT_FIELDS,
  mapDbCommentToCommentItem,
  type CommentItem,
} from './comments.service.base';

/** M4.3 — server reader for work-item discussion threads (no client mount fetch). */
export async function getWorkItemDiscussion(
  workItemId: string
): Promise<CommentItem[]> {
  const user = await getUser();
  if (!user) {
    return [];
  }

  return safeServerFetch(
    (async () => {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from('comments')
        .select(COMMENT_SELECT_FIELDS)
        .eq('work_item_id', workItemId)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return (data ?? []).map(mapDbCommentToCommentItem);
    })(),
    [],
    `fetch discussion for work item ${workItemId}`
  );
}
