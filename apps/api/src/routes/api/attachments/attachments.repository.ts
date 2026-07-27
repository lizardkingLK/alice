import { auditCreate, auditUpdate } from '@/lib/audit';
import { supabase } from '@/lib/supabase';
import { ATTACHMENT_SELECT, type AttachmentWithUploader } from '@repo/types';

export type CreateAttachmentInput = {
  work_item_id: string;
  uploader_id: string;
  file_name: string;
  storage_path: string;
  file_size: number;
  mime_type: string;
};

export class AttachmentsRepository {
  async getById(id: string): Promise<AttachmentWithUploader | null> {
    const { data, error } = await supabase
      .from('attachments')
      .select(ATTACHMENT_SELECT)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('database error get attachment:', error.message);
      throw new Error('Failed to retrieve attachment');
    }

    return (data as AttachmentWithUploader | null) ?? null;
  }

  async create(input: CreateAttachmentInput): Promise<AttachmentWithUploader> {
    const { data, error } = await supabase
      .from('attachments')
      .insert({
        work_item_id: input.work_item_id,
        uploader_id: input.uploader_id,
        file_name: input.file_name,
        storage_path: input.storage_path,
        file_size: input.file_size,
        mime_type: input.mime_type,
        ...auditCreate(input.uploader_id),
      })
      .select(ATTACHMENT_SELECT)
      .single();

    if (error) {
      console.error('database error create attachment:', error.message);
      throw new Error(`Failed to create attachment: ${error.message}`);
    }

    return data as unknown as AttachmentWithUploader;
  }

  async archive(id: string, actorId: string): Promise<void> {
    const { error } = await supabase
      .from('attachments')
      .update({
        status: 'archived',
        ...auditUpdate(actorId),
      })
      .eq('id', id);

    if (error) {
      console.error('database error archive attachment:', error.message);
      throw new Error('Failed to delete attachment');
    }
  }

  async workItemExists(workItemId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('work_items')
      .select('id')
      .eq('id', workItemId)
      .maybeSingle();

    if (error) {
      console.error('database error check work item:', error.message);
      throw new Error('Failed to validate work item');
    }

    return Boolean(data);
  }
}

export const attachmentsRepository = new AttachmentsRepository();
