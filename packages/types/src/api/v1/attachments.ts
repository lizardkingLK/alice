import { z } from 'zod';
import { Constants } from '../../generated/supabase/database.types.js';
import type { attachmentsGetPayload } from '../../generated/prisma/models/attachments.js';
import { expectedUpdatedAtSchema } from '../../optimistic-lock.js';
import { workItemUserSelect } from './work-items.js';

/**
 * Prisma `select` for unused Express attachment list GETs.
 * Field list must stay aligned with `ATTACHMENT_SELECT` in `attachments.ts`.
 */
export const attachmentUploaderSelect = workItemUserSelect;

export const attachmentListSelect = {
  id: true,
  work_item_id: true,
  file_name: true,
  file_size: true,
  mime_type: true,
  storage_path: true,
  created_at: true,
  updated_at: true,
  uploader_id: true,
  status: true,
  created_by: true,
  updated_by: true,
  uploader: { select: attachmentUploaderSelect },
} as const;

export type AttachmentListRow = attachmentsGetPayload<{
  select: typeof attachmentListSelect;
}>;

const recordStatusSchema = z.enum(Constants.public.Enums.RecordStatus);

const attachmentUploaderSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  email: z.string(),
  profile_picture: z.string().nullable().optional(),
});

/** Wire shape for attachment rows with uploader embed (upload responses, list rows). */
export const attachmentWithUploaderSchema = z.object({
  id: z.uuid(),
  work_item_id: z.uuid(),
  file_name: z.string(),
  file_size: z.number().int(),
  mime_type: z.string(),
  storage_path: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  uploader_id: z.uuid(),
  status: recordStatusSchema,
  created_by: z.uuid().nullable(),
  updated_by: z.uuid().nullable(),
  uploader: attachmentUploaderSchema.nullable(),
});

export type AttachmentWithUploaderWire = z.infer<
  typeof attachmentWithUploaderSchema
>;

export const workItemIdSchema = z.uuid({ message: 'Invalid work item id.' });

/** Body for the archive (soft-delete) mutation, which still needs the lock check. */
export const archiveAttachmentSchema = z.object({
  expectedUpdatedAt: expectedUpdatedAtSchema,
});

export type ArchiveAttachmentBody = z.infer<typeof archiveAttachmentSchema>;

export const createUploadSessionSchema = z.object({
  work_item_id: workItemIdSchema.optional(),
  file_name: z.string().min(1),
  content_type: z.string().min(1),
  file_size: z.number().int().positive(),
});

export type CreateUploadSessionBody = z.infer<typeof createUploadSessionSchema>;

export const finalizeUploadSchema = z.object({
  work_item_id: workItemIdSchema.optional(),
  storage_path: z.string().min(1),
  file_name: z.string().min(1),
  file_size: z.number().int().positive(),
  mime_type: z.string().min(1),
});

export type FinalizeUploadBody = z.infer<typeof finalizeUploadSchema>;

export const attachmentSignedUrlsSchema = z.object({
  previewUrl: z.url(),
  downloadUrl: z.url(),
  expiresAt: z.string(),
});

export type AttachmentSignedUrls = z.infer<typeof attachmentSignedUrlsSchema>;

export const attachmentUploadSessionSchema = z.object({
  upload: z.object({
    bucket: z.string().min(1),
    signedUrl: z.url(),
    token: z.string().min(1),
    path: z.string().min(1),
  }),
});

export type AttachmentUploadSession = z.infer<
  typeof attachmentUploadSessionSchema
>;

export const uploadedAttachmentResultSchema = z.object({
  success: z.literal(true),
  path: z.string().min(1),
  url: z.url(),
  attachment: attachmentWithUploaderSchema.optional(),
});

export type UploadedAttachmentResult = z.infer<
  typeof uploadedAttachmentResultSchema
>;

export const deleteAttachmentResponseSchema = z.object({
  success: z.literal(true),
});

export type DeleteAttachmentResponse = z.infer<
  typeof deleteAttachmentResponseSchema
>;

/** GET `/api/attachments` query (unused by Next; Prisma list escape hatch). */
export const listAttachmentsQuerySchema = z.object({
  work_item_id: workItemIdSchema,
});

export type ListAttachmentsQuery = z.infer<typeof listAttachmentsQuerySchema>;
