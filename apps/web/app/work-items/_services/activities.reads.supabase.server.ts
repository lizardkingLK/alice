import { createClient } from '@/lib/supabase/server';
import { isMissingRelationError, throwIfError } from '@/lib/db/query';
import { getUser } from '@/lib/auth';
import { safeServerFetch } from '@/lib/safe-server-fetch';
import {
  ACTIVITY_FEED_LIMIT,
  WORK_ITEM_ACTIVITY_SELECT,
  normalizeActivityRow,
  type WorkItemActivity,
  type WorkItemActivityRowRaw,
} from '@repo/types';

export type { WorkItemActivity };

async function fetchWorkItemActivities(
  workItemId: string
): Promise<WorkItemActivity[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('activities')
    .select(WORK_ITEM_ACTIVITY_SELECT)
    .eq('work_item_id', workItemId)
    .order('created_at', { ascending: false })
    .limit(ACTIVITY_FEED_LIMIT);

  if (error) {
    if (isMissingRelationError(error)) {
      console.warn(
        'warn. activities is not available yet; returning empty activity feed. Apply the add_activities migration to enable the Activity tab.'
      );
      return [];
    }

    throwIfError(
      error,
      'failed to list work item activities',
      'Failed to load activity.'
    );
  }

  const rows = (data ?? []) as unknown as WorkItemActivityRowRaw[];
  return rows.map((row) => normalizeActivityRow(row));
}

/** SSR entry — empty when unsigned-in; soft-falls back on query failure. */
export async function getWorkItemActivities(
  workItemId: string
): Promise<WorkItemActivity[]> {
  const user = await getUser();
  if (!user) {
    return [];
  }

  return safeServerFetch(
    fetchWorkItemActivities(workItemId),
    [],
    `fetch activities for work item ${workItemId}`
  );
}
