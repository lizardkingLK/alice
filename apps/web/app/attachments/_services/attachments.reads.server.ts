import { getUser } from '@/lib/auth';
import { shouldReadViaApi } from '@/lib/data-retrieval.server';
import { safeServerFetch } from '@/lib/safe-server-fetch';
import type { AttachmentWithUploader } from '@repo/types';
import { fetchWorkItemAttachmentsFromApi } from './attachments.reads.api.server';
import { fetchWorkItemAttachmentsFromSupabase } from './attachments.reads.supabase.server';

export type { AttachmentWithUploader };

/**
 * Public server read facade — picks supabase-js (default) or Express GET
 * based on `DATA_READS_VIA_API`. Empty when signed out; soft-falls back on failure.
 * No signed URLs — mint those on click via the attachments API.
 */
export async function getWorkItemAttachments(
  workItemId: string
): Promise<AttachmentWithUploader[]> {
  const user = await getUser();
  if (!user) {
    return [];
  }

  const read = shouldReadViaApi('attachments')
    ? fetchWorkItemAttachmentsFromApi(workItemId)
    : fetchWorkItemAttachmentsFromSupabase(workItemId);

  return safeServerFetch(
    read,
    [],
    `fetch attachments for work item ${workItemId}`
  );
}
