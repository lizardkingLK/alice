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

function mapAttachmentMutationRow(
  row: AttachmentListRow
): AttachmentWithUploader {
  return {
    id: row.id,
    work_item_id: row.work_item_id,
    file_name: row.file_name,
    file_size: row.file_size,
    mime_type: row.mime_type,
    storage_path: row.storage_path,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
    uploader_id: row.uploader_id,
    status: row.status,
    created_by: row.created_by,
    updated_by: row.updated_by,
    uploader: row.uploader,
  };
}

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

  /** Post-mutation / optimistic-lock row via Prisma (no PostgREST hop). */
  async getMutationRowById(id: string): Promise<AttachmentWithUploader | null> {
    try {
      const row = await prisma.attachments.findUnique({
        where: { id },
        select: attachmentListSelect,
      });
      if (!row) {
        return null;
      }
      return mapAttachmentMutationRow(row);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('error. failed to get attachment mutation row:', message);
      throw new Error('Failed to retrieve attachment');
    }
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

    const row = await this.getMutationRowById(created.id);
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
      fetchUpdated: () => this.getMutationRowById(id),
      fetchCurrent: () => this.getMutationRowById(id),
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
