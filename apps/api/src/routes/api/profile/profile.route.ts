import multer, { Multer } from 'multer';
import { Router } from 'express';
import { z } from 'zod';
import {
  requireApiAuth,
  type AuthenticatedRequest,
} from '../../../middlewares/auth';
import {
  handleMultipartImageUpload,
  MAX_PUBLIC_IMAGE_BYTES,
} from '../../../lib/image-upload-route';
import { trySendOptimisticLockError } from '../../../lib/optimistic-lock';
import { ProfileService, updateOwnProfileSchema } from './profile.service';

export type ProfileRouterDeps = {
  profileService: ProfileService;
};

export function createProfileRouter(deps: ProfileRouterDeps) {
  const { profileService } = deps;
  const profileRouter: Router = Router();

  const upload: Multer = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: MAX_PUBLIC_IMAGE_BYTES,
    },
  });

  /**
   * Self-service cover photo upload for the signed-in user.
   * Multipart field: `file`. Persists forever public URL on `public.users.cover_picture`.
   */
  profileRouter.post(
    '/cover',
    requireApiAuth,
    upload.single('file'),
    async (req: AuthenticatedRequest, res) => {
      await handleMultipartImageUpload(req, res, {
        failureLabel: 'cover picture',
        update: (actorId, file, expectedUpdatedAt) =>
          profileService.updateOwnCoverPicture(
            actorId,
            file,
            expectedUpdatedAt
          ),
      });
    }
  );

  /**
   * Self-service profile picture upload for the signed-in user.
   * Multipart field: `file`. Persists forever public URL on `public.users`.
   */
  profileRouter.post(
    '/',
    requireApiAuth,
    upload.single('file'),
    async (req: AuthenticatedRequest, res) => {
      await handleMultipartImageUpload(req, res, {
        failureLabel: 'profile picture',
        update: (actorId, file, expectedUpdatedAt) =>
          profileService.updateOwnProfilePicture(
            actorId,
            file,
            expectedUpdatedAt
          ),
      });
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
        if (trySendOptimisticLockError(res, error)) return;
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

  return profileRouter;
}
