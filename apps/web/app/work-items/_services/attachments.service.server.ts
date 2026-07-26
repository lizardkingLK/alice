import { createClient } from '@/lib/supabase/server';
import { throwIfError } from '@/lib/db/query';
import { getUser } from '@/lib/auth';
import { safeServerFetch } from '@/lib/safe-server-fetch';
import { ATTACHMENT_SELECT, type AttachmentWithUploader } from '@repo/types';

export type { AttachmentWithUploader };

/**
 * Direct Supabase RSC reader for work-item attachment metadata.
 * No signed URLs — mint those on click via the attachments API.
 */
async function fetchWorkItemAttachments(
  workItemId: string
): Promise<AttachmentWithUploader[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('attachments')
    .select(ATTACHMENT_SELECT)
    .eq('work_item_id', workItemId)
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  throwIfError(
    error,
    'failed to list work item attachments',
    'Failed to load attachments.'
  );

  return (data as AttachmentWithUploader[] | null) ?? [];
}

/** SSR entry — empty when unsigned-in; soft-falls back on query failure. */
export async function getWorkItemAttachments(
  workItemId: string
): Promise<AttachmentWithUploader[]> {
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
