import { WorkItemStatusEnum, projectRelationSelect } from '@repo/types';
import { createClient } from '@/lib/supabase/server';
import { computeAssignedCompletionPercent } from '@/app/_components/home/compute-assigned-completion';
import type {
  HomeLaunchpadCompletion,
  HomeLaunchpadNotification,
  HomeLaunchpadWorkItem,
} from '@/app/_components/home/home-launchpad.types';

export const MY_WORK_WIP_LIMIT = 5;
export const MY_WORK_UNREAD_LIMIT = 5;

type WorkItemRow = {
  id: string;
  title: string;
  slug: string | null;
  status: HomeLaunchpadWorkItem['status'];
  updated_at: string;
  project: { key: string | null; name: string } | null;
};

/** Assigned active items that are not Done or Draft, most recently updated first. */
export async function listAssignedWipItems(
  userId: string,
  limit: number = MY_WORK_WIP_LIMIT
): Promise<HomeLaunchpadWorkItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('work_items')
    .select(`id, title, slug, status, updated_at, ${projectRelationSelect()}`)
    .eq('record_status', 'active')
    .eq('assignee_id', userId)
    .neq('status', WorkItemStatusEnum.Done)
    .neq('status', WorkItemStatusEnum.Draft)
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('error. list assigned WIP:', error.message);
    throw new Error('Failed to list assigned WIP work items');
  }

  return ((data ?? []) as unknown as WorkItemRow[]).map((row) => ({
    id: row.id,
    title: row.title,
    slug: row.slug ?? null,
    status: row.status,
    projectKey: row.project?.key ?? null,
    updatedAt: row.updated_at,
  }));
}

async function countAssignedByStatus(
  userId: string,
  status?: typeof WorkItemStatusEnum.Done
): Promise<number> {
  const supabase = await createClient();
  let query = supabase
    .from('work_items')
    .select('id', { count: 'exact', head: true })
    .eq('record_status', 'active')
    .eq('assignee_id', userId);

  if (status) {
    query = query.eq('status', status);
  }

  const { count, error } = await query;
  if (error) {
    console.error('error. count assigned work items:', error.message);
    throw new Error('Failed to count assigned work items');
  }
  return count ?? 0;
}

export async function getAssignedCompletion(
  userId: string
): Promise<HomeLaunchpadCompletion> {
  const [totalCount, doneCount] = await Promise.all([
    countAssignedByStatus(userId),
    countAssignedByStatus(userId, WorkItemStatusEnum.Done),
  ]);

  return {
    doneCount,
    totalCount,
    percent: computeAssignedCompletionPercent(doneCount, totalCount),
  };
}

export async function listUnreadNotifications(
  userId: string,
  limit: number = MY_WORK_UNREAD_LIMIT
): Promise<HomeLaunchpadNotification[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('notifications')
    .select('id, message, type, related_item_id, created_at')
    .eq('user_id', userId)
    .eq('status', 'active')
    .eq('read_status', false)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('error. list unread notifications:', error.message);
    throw new Error('Failed to list unread notifications');
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    message: row.message,
    type: row.type,
    relatedItemId: row.related_item_id ?? null,
    createdAt: row.created_at,
  }));
}
