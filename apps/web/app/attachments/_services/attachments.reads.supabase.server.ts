import { createClient } from '@/lib/supabase/server';
import { throwIfError } from '@/lib/db/query';
import { ATTACHMENT_SELECT, type AttachmentWithUploader } from '@repo/types';

/**
 * Direct Supabase RSC reader for work-item attachment metadata.
 * No signed URLs — mint those on click via the attachments API.
 */
export async function fetchWorkItemAttachmentsFromSupabase(
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
