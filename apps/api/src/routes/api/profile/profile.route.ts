import multer, { Multer } from 'multer';
import { Router } from 'express';
import { z } from 'zod';
import { requireApiAuth, type AuthenticatedRequest } from '@/middlewares/auth';
import {
  profileService,
  updateOwnProfileSchema,
} from '@/routes/api/profile/profile.service';

const profileRouter: Router = Router();

const MAX_PROFILE_PICTURE_BYTES = 2 * 1024 * 1024;

const upload: Multer = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_PROFILE_PICTURE_BYTES,
  },
});

/**
 * Self-service profile picture upload for the signed-in user.
 * Multipart field: `file`. Persists forever public URL on `public.users`.
 */
profileRouter.post(
  '/',
  requireApiAuth,
  upload.single('file'),
  async (req: AuthenticatedRequest, res) => {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'No file uploaded.' });
      return;
    }

    try {
      const result = await profileService.updateOwnProfilePicture(userId, file);
      res.json(result);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to update profile picture.';
      let status = 500;
      if (
        message.includes('Invalid file type') ||
        message.includes('No file')
      ) {
        status = 400;
      } else if (message.includes('not found')) {
        status = 404;
      }
      if (status >= 500) {
        console.error('error. profile picture upload:', message);
      }
      res.status(status).json({ error: message });
    }
  }
);

/**
 * Self-service profile field update (name today).
 * Does not reuse admin-gated `/api/users/:id`.
 */
profileRouter.patch(
  '/',
  requireApiAuth,
  async (req: AuthenticatedRequest, res) => {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const parsed = updateOwnProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: z.treeifyError(parsed.error) });
      return;
    }

    try {
      const user = await profileService.updateOwnName(userId, parsed.data);
      res.json({ user });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to update profile.';
      const status = message.includes('not found') ? 404 : 500;
      if (status >= 500) {
        console.error('error. profile update:', message);
      }
      res.status(status).json({ error: message });
    }
  }
);

export default profileRouter;
