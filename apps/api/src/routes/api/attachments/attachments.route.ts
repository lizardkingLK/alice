import multer, { Multer } from 'multer';
import express, { type Router } from 'express';
import { z } from 'zod';

import { requireApiAuth, type AuthenticatedRequest } from '../../../middlewares/auth';
import {
  AttachmentGoneError,
  AttachmentNotFoundError,
  deleteAttachment,
  getAttachmentSignedUrls,
  uploadAttachmentFile,
} from './attachments.service';

const attachmentsRouter: Router = express.Router();

const upload: Multer = multer({
  storage: multer.memoryStorage(),
  limits: {
    // eslint-disable-next-line sonarjs/content-length
    fileSize: 10 * 1024 * 1024,
  },
});

const workItemIdSchema = z.uuid({ message: 'Invalid work item id.' });

function isNotFoundError(error: unknown): boolean {
  return (
    error instanceof AttachmentNotFoundError ||
    (error instanceof Error && /not found/i.test(error.message))
  );
}

/**
 * Fetch an attachment's short-lived access URLs (preview + download).
 * Auth required — URLs are never stored in the DB.
 */
attachmentsRouter.get(
  '/:id',
  requireApiAuth,
  async (req: AuthenticatedRequest, res) => {
    try {
      const urls = await getAttachmentSignedUrls(req.params.id!);
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
    try {
      await deleteAttachment(req.params.id!, req.userId!);
      res.json({ success: true });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to delete attachment';
      console.error('error. attachment delete failed:', message);
      res.status(isNotFoundError(error) ? 404 : 500).json({ error: message });
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
      const result = await uploadAttachmentFile(file, req.userId!, workItemId);
      res.status(workItemId ? 201 : 200).json(result);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'error. file uploading failed';
      console.error('error. attachment upload failed:', message);
      res.status(isNotFoundError(error) ? 404 : 500).json({
        error: isNotFoundError(error)
          ? message
          : 'error. file uploading failed',
      });
    }
  }
);

export default attachmentsRouter;
