import { expectedUpdatedAtSchema } from '@repo/types';
import z from 'zod';

export const workItemIdSchema = z.uuid({ message: 'Invalid work item id.' });

/** Body for the archive (soft-delete) mutation, which still needs the lock check. */
export const archiveAttachmentSchema = z.object({
  expectedUpdatedAt: expectedUpdatedAtSchema,
});

export const createUploadSessionSchema = z.object({
  work_item_id: workItemIdSchema.optional(),
  file_name: z.string().min(1),
  content_type: z.string().min(1),
  file_size: z.number().int().positive(),
});

export const finalizeUploadSchema = z.object({
  work_item_id: workItemIdSchema.optional(),
  storage_path: z.string().min(1),
  file_name: z.string().min(1),
  file_size: z.number().int().positive(),
  mime_type: z.string().min(1),
});
