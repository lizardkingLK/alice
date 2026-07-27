import multer, { Multer } from 'multer';
import express, { type Router } from 'express';

import { requireApiAuth, type AuthenticatedRequest } from '@/middlewares/auth';
import { uploadAttachmentFile } from '@/routes/api/attachments/attachments.service';

const attachmentsRouter: Router = express.Router();

const upload: Multer = multer({
  storage: multer.memoryStorage(),
  limits: {
    // eslint-disable-next-line sonarjs/content-length
    fileSize: 10 * 1024 * 1024,
  },
});

/**
 * Upload a single file to the private attachments bucket.
 * One file per request (`upload.single`) — concurrent-safe across requests.
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

    try {
      const result = await uploadAttachmentFile(file);
      res.json(result);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'error. file uploading failed';
      console.error('error. attachment upload failed:', message);
      res.status(500).json({
        error: 'error. file uploading failed',
      });
    }
  }
);

export default attachmentsRouter;
