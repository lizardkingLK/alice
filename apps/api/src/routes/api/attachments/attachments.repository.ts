import { prisma } from '../../../lib/prisma';
import {
  prismaAuditCreate,
  prismaAuditUpdate,
  prismaLockTimestamp,
} from '../../../lib/prisma-audit';
import { resolveOptimisticPrismaUpdate } from '../../../lib/optimistic-lock';
import {
  ATTACHMENT_SELECT,
  attachmentListSelect,
  Database,
  type AttachmentListRow,
  type AttachmentWithUploader,
} from '@repo/types';
import { SupabaseClient } from '@supabase/supabase-js';

export type CreateAttachmentInput = {
  work_item_id: string;
  uploader_id: string;
  file_name: string;
  storage_path: string;
  file_size: number;
  mime_type: string;
};

export class AttachmentsRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async getById(id: string): Promise<AttachmentWithUploader | null> {
    const { data, error } = await this.db
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
    const created = await prisma.attachments.create({
      data: {
        work_item_id: input.work_item_id,
        uploader_id: input.uploader_id,
        file_name: input.file_name,
        storage_path: input.storage_path,
        file_size: input.file_size,
        mime_type: input.mime_type,
        ...prismaAuditCreate(input.uploader_id),
      },
    });

    const row = await this.getById(created.id);
    if (!row) {
      throw new Error('Failed to create attachment');
    }
    return row;
  }

  async archive(
    id: string,
    actorId: string,
    expectedUpdatedAt: string
  ): Promise<void> {
    const { count } = await prisma.attachments.updateMany({
      where: { id, updated_at: prismaLockTimestamp(expectedUpdatedAt) },
      data: {
        status: 'archived',
        ...prismaAuditUpdate(actorId),
      },
    });

    await resolveOptimisticPrismaUpdate({
      count,
      fetchUpdated: () => this.getById(id),
      fetchCurrent: () => this.getById(id),
      notFoundMessage: 'Attachment not found',
    });
  }

  async workItemExists(workItemId: string): Promise<boolean> {
    const { data, error } = await this.db
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

  /**
   * Unused Express list path (Prisma). Do not call from mutation/lock flows.
   */
  async listByWorkItemId(workItemId: string): Promise<AttachmentListRow[]> {
    return await prisma.attachments.findMany({
      where: {
        work_item_id: workItemId,
        status: 'active',
      },
      orderBy: { created_at: 'desc' },
      select: attachmentListSelect,
    });
  }
}
