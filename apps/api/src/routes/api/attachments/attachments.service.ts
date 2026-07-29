import { env } from '../../../config/env';
import {
  createSignedStorageUrl,
  DEFAULT_SIGNED_URL_SECONDS,
  removeStorageObjects,
  sanitizeFileName,
  signedUrlExpiresAt,
  storageObjectExists,
  uploadToStorage,
} from '../../../lib/file-helpers';

/** Attachment row does not exist (or is archived/deleted). */
export class AttachmentNotFoundError extends Error {
  constructor(message = 'Attachment not found') {
    super(message);
    this.name = 'AttachmentNotFoundError';
  }
}

/** Row exists but the underlying Storage object is gone (orphaned row). */
export class AttachmentGoneError extends Error {
  constructor(message = 'Attachment file is no longer available') {
    super(message);
    this.name = 'AttachmentGoneError';
  }
}
import { attachmentsRepository } from './attachments.repository';
import type { AttachmentWithUploader } from '@repo/types';

export type UploadedAttachmentResult = {
  success: true;
  path: string;
  /** Signed URL (attachments bucket is private). */
  url: string;
  /** Present when upload is linked to a work item (DB row created). */
  attachment?: AttachmentWithUploader;
};

export type AttachmentSignedUrls = {
  previewUrl: string;
  downloadUrl: string;
  expiresAt: string;
};

/**
 * Upload one file to the attachments bucket.
 * When `workItemId` is set, also inserts an `attachments` row (details upload).
 * Without it, storage-only (playground `/files` page).
 */
export async function uploadAttachmentFile(
  file: Express.Multer.File,
  actorId: string,
  workItemId?: string
): Promise<UploadedAttachmentResult> {
  const bucket = env.STORAGE_BUCKET_ATTACHMENTS;
  const safeName = sanitizeFileName(file.originalname);
  const path = workItemId
    ? `${workItemId}/${Date.now()}-${safeName}`
    : `${Date.now()}-${safeName}`;

  if (workItemId) {
    const exists = await attachmentsRepository.workItemExists(workItemId);
    if (!exists) {
      throw new Error('Work item not found');
    }
  }

  const uploaded = await uploadToStorage({
    bucket,
    path,
    buffer: file.buffer,
    contentType: file.mimetype,
  });

  try {
    const url = await createSignedStorageUrl(bucket, uploaded.path);

    if (!workItemId) {
      return {
        success: true,
        path: uploaded.path,
        url,
      };
    }

    const attachment = await attachmentsRepository.create({
      work_item_id: workItemId,
      uploader_id: actorId,
      file_name: file.originalname,
      storage_path: uploaded.path,
      file_size: file.size,
      mime_type: file.mimetype || 'application/octet-stream',
    });

    return {
      success: true,
      path: uploaded.path,
      url,
      attachment,
    };
  } catch (error) {
    await removeStorageObjects(bucket, [uploaded.path]);
    throw error;
  }
}

/** Mint preview + download signed URLs for an active attachment. */
export async function getAttachmentSignedUrls(
  attachmentId: string
): Promise<AttachmentSignedUrls> {
  const attachment = await attachmentsRepository.getById(attachmentId);
  if (attachment?.status !== 'active') {
    throw new AttachmentNotFoundError();
  }

  const bucket = env.STORAGE_BUCKET_ATTACHMENTS;

  // Signing never validates existence — check first so orphaned rows return a
  // distinct "gone" state instead of a URL that 404s on fetch (and loops the
  // regenerate UI).
  const exists = await storageObjectExists(bucket, attachment.storage_path);
  if (!exists) {
    throw new AttachmentGoneError();
  }

  const expiresInSeconds = DEFAULT_SIGNED_URL_SECONDS;

  const [previewUrl, downloadUrl] = await Promise.all([
    createSignedStorageUrl(bucket, attachment.storage_path, {
      expiresInSeconds,
    }),
    createSignedStorageUrl(bucket, attachment.storage_path, {
      expiresInSeconds,
      // Storage SDK encodes the final URL. Keep the query value filename-safe
      // without pre-encoding it (which would double-encode `%` characters).
      download: sanitizeFileName(attachment.file_name),
    }),
  ]);

  return {
    previewUrl,
    downloadUrl,
    expiresAt: signedUrlExpiresAt(expiresInSeconds),
  };
}

/** Soft-delete the row and best-effort remove the Storage object. */
export async function deleteAttachment(
  attachmentId: string,
  actorId: string
): Promise<void> {
  const attachment = await attachmentsRepository.getById(attachmentId);
  if (attachment?.status !== 'active') {
    throw new AttachmentNotFoundError();
  }

  await attachmentsRepository.archive(attachmentId, actorId);
  await removeStorageObjects(env.STORAGE_BUCKET_ATTACHMENTS, [
    attachment.storage_path,
  ]);
}
