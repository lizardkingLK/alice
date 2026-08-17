import multer, { Multer } from 'multer';
import express, { Router } from 'express';
import { z } from 'zod';

import {
  requireApiAuth,
  type AuthenticatedRequest,
} from '../../../middlewares/auth';
import { trySendOptimisticLockError } from '../../../lib/optimistic-lock';
import {
  AttachmentGoneError,
  AttachmentNotFoundError,
  AttachmentsService,
} from './attachments.service';
import {
  archiveAttachmentSchema,
  createUploadSessionSchema,
  finalizeUploadSchema,
  workItemIdSchema,
} from './attachments.schemas';

const upload: Multer = multer({
  storage: multer.memoryStorage(),
  limits: {
    // eslint-disable-next-line sonarjs/content-length
    fileSize: 10 * 1024 * 1024,
  },
});

function isNotFoundError(error: unknown): boolean {
  return (
    error instanceof AttachmentNotFoundError ||
    (error instanceof Error && /not found/i.test(error.message))
  );
}

export type AttachmentsRouterDeps = {
  attachmentsService: AttachmentsService;
};

/**
 * Fetch an attachment's short-lived access URLs (preview + download).
 * Auth required — URLs are never stored in the DB.
 */
export function createAttachmentsRouter(deps: AttachmentsRouterDeps): Router {
  const { attachmentsService } = deps;

  const attachmentsRouter: Router = express.Router();

  attachmentsRouter.get(
    '/:id',
    requireApiAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const urls = await attachmentsService.getAttachmentSignedUrls(
          req.params.id!
        );
        res.json(urls);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Failed to create attachment URL';
        console.error('error. attachment signed URL failed:', message);

        if (error instanceof AttachmentGoneError) {
          return res.status(410).json({ error: message });
        }

        res.status(isNotFoundError(error) ? 404 : 500).json({ error: message });
      }
    }
  );

  /**
   * Soft-delete attachment row + best-effort Storage remove.
   */
  attachmentsRouter.delete(
    '/:id',
    requireApiAuth,
    async (req: AuthenticatedRequest, res) => {
      const parsed = archiveAttachmentSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: z.treeifyError(parsed.error) });
      }

      try {
        await attachmentsService.deleteAttachment(
          req.params.id!,
          req.userId!,
          parsed.data.expectedUpdatedAt
        );
        res.json({ success: true });
      } catch (error) {
        if (trySendOptimisticLockError(res, error)) return;
        const message =
          error instanceof Error
            ? error.message
            : 'Failed to delete attachment';
        console.error('error. attachment delete failed:', message);
        res.status(isNotFoundError(error) ? 404 : 500).json({ error: message });
      }
    }
  );

  /**
   * Create a browser direct-to-Supabase upload session.
   *
   * This prevents Vercel from receiving the file bytes (which can trigger
   * FUNCTION_PAYLOAD_TOO_LARGE) by sending only small JSON metadata.
   */
  attachmentsRouter.post(
    '/upload-session',
    requireApiAuth,
    async (req: AuthenticatedRequest, res) => {
      const parsed = createUploadSessionSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: z.treeifyError(parsed.error) });
      }

      try {
        const session = await attachmentsService.createAttachmentUploadSession({
          workItemId: parsed.data.work_item_id,
          fileName: parsed.data.file_name,
          contentType: parsed.data.content_type,
          fileSize: parsed.data.file_size,
        });

        return res.json(session);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Failed to create upload session';
        console.error('error. attachment upload session failed:', message);

        if (/Work item not found/i.test(message)) {
          return res.status(404).json({ error: message });
        }

        return res.status(500).json({ error: message });
      }
    }
  );

  /**
   * Finalize upload by committing the attachment DB row (when `work_item_id`
   * is provided) and returning a signed access URL.
   */
  attachmentsRouter.post(
    '/finalize',
    requireApiAuth,
    async (req: AuthenticatedRequest, res) => {
      const parsed = finalizeUploadSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: z.treeifyError(parsed.error) });
      }

      try {
        const result = await attachmentsService.finalizeAttachmentUpload({
          actorId: req.userId!,
          workItemId: parsed.data.work_item_id,
          storagePath: parsed.data.storage_path,
          fileName: parsed.data.file_name,
          fileSize: parsed.data.file_size,
          mimeType: parsed.data.mime_type,
        });

        return res.json(result);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Failed to finalize upload';
        console.error('error. attachment upload finalize failed:', message);

        if (/Invalid upload target/i.test(message)) {
          return res.status(400).json({ error: message });
        }

        if (/Uploaded file not found in storage/i.test(message)) {
          return res.status(404).json({ error: message });
        }

        return res.status(500).json({ error: message });
      }
    }
  );

  /**
   * Upload a single file to the private attachments bucket.
   * Optional multipart field `work_item_id` also inserts an `attachments` row.
   */
  attachmentsRouter.post(
    '/',
    requireApiAuth,
    upload.single('file'),
    async (req: AuthenticatedRequest, res) => {
      const file = req.file;
      if (!file) {
        res.status(400).json({
          error: 'error. no file uploaded',
        });
        return;
      }

      const rawWorkItemId = req.body?.work_item_id as string | undefined;
      let workItemId: string | undefined;
      if (rawWorkItemId) {
        const parsed = workItemIdSchema.safeParse(rawWorkItemId);
        if (!parsed.success) {
          res.status(400).json({ error: z.treeifyError(parsed.error) });
          return;
        }
        workItemId = parsed.data;
      }

      try {
        const result = await attachmentsService.uploadAttachmentFile(
          file,
          req.userId!,
          workItemId
        );
        res.status(workItemId ? 201 : 200).json(result);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'error. file uploading failed';
        console.error('error. attachment upload failed:', message);
        res.status(isNotFoundError(error) ? 404 : 500).json({
          error: isNotFoundError(error)
            ? message
            : 'error. file uploading failed',
        });
      }
    }
  );

  return attachmentsRouter;
}
