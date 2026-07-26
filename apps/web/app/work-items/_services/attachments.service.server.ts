import { createClient } from '@/lib/supabase/server';
import { throwIfError } from '@/lib/db/query';
import { getUser } from '@/lib/auth';
import { safeServerFetch } from '@/lib/safe-server-fetch';
import { Tables, userRelationSelect } from '@repo/types';

const UPLOADER_SELECT = userRelationSelect('uploader', 'uploader_id');

export type WorkItemAttachment = Pick<
  Tables<'attachments'>,
  | 'id'
  | 'work_item_id'
  | 'file_name'
  | 'file_size'
  | 'mime_type'
  | 'storage_path'
  | 'created_at'
  | 'uploader_id'
  | 'status'
> & {
  uploader: {
    id: string;
    name: string;
    email: string;
    profile_picture?: string | null;
  } | null;
};

/**
 * Direct Supabase RSC reader for work-item attachment metadata.
 * No signed URLs — mint those on click via the attachments API (Part 2 §2–3).
 */
async function fetchWorkItemAttachments(
  workItemId: string
): Promise<WorkItemAttachment[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('attachments')
    .select(
      `id, work_item_id, file_name, file_size, mime_type, storage_path, created_at, uploader_id, status, ${UPLOADER_SELECT}`
    )
    .eq('work_item_id', workItemId)
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  throwIfError(
    error,
    'failed to list work item attachments',
    'Failed to load attachments.'
  );

  return (data as WorkItemAttachment[] | null) ?? [];
}

/** SSR entry — empty when unsigned-in; soft-falls back on query failure. */
export async function getWorkItemAttachments(
  workItemId: string
): Promise<WorkItemAttachment[]> {
  const user = await getUser();
  if (!user) {
    return [];
  }

  return safeServerFetch(
    fetchWorkItemAttachments(workItemId),
    [],
    `fetch attachments for work item ${workItemId}`
  );
}
