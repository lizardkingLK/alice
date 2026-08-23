import type { Response } from 'express';
import { z } from 'zod';
import { expectedUpdatedAtSchema } from '@repo/types';
import { trySendOptimisticLockError } from './optimistic-lock';
import type { AuthenticatedRequest } from '../middlewares/auth';

export const MAX_PUBLIC_IMAGE_BYTES = 2 * 1024 * 1024;

type ImageUploadUpdater = (
  actorId: string,
  file: Express.Multer.File,
  expectedUpdatedAt: string,
  routeParams: Record<string, string | undefined>
) => Promise<unknown>;

function statusForImageUploadError(message: string): number {
  if (message.includes('Invalid file type') || message.includes('No file')) {
    return 400;
  }
  if (message.includes('Unauthorized')) {
    return 403;
  }
  if (message.includes('not found')) {
    return 404;
  }
  return 500;
}

/**
 * Shared multipart image upload handler for profile/project public images.
 * Expects multer field `file` and body `expectedUpdatedAt`.
 */
export async function handleMultipartImageUpload(
  req: AuthenticatedRequest,
  res: Response,
  options: {
    readonly update: ImageUploadUpdater;
    readonly failureLabel: string;
    readonly requireParam?: string;
    readonly missingParamMessage?: string;
  }
): Promise<void> {
  const actorId = req.userId;
  if (!actorId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  if (options.requireParam && !req.params[options.requireParam]) {
    res.status(400).json({
      error:
        options.missingParamMessage ?? `${options.requireParam} is required`,
    });
    return;
  }

  const file = req.file;
  if (!file) {
    res.status(400).json({ error: 'No file uploaded.' });
    return;
  }

  const expectedUpdatedAtResult = expectedUpdatedAtSchema.safeParse(
    req.body?.expectedUpdatedAt
  );
  if (!expectedUpdatedAtResult.success) {
    res.status(400).json({
      error: z.treeifyError(expectedUpdatedAtResult.error),
    });
    return;
  }

  try {
    const result = await options.update(
      actorId,
      file,
      expectedUpdatedAtResult.data,
      req.params
    );
    res.json(result);
  } catch (error) {
    if (trySendOptimisticLockError(res, error)) {
      return;
    }
    const message =
      error instanceof Error
        ? error.message
        : `Failed to update ${options.failureLabel}.`;
    const status = statusForImageUploadError(message);
    if (status >= 500) {
      console.error(`error. ${options.failureLabel} upload:`, message);
    }
    res.status(status).json({ error: message });
  }
}
