import { env } from '../../../config/env';
import {
  createSignedStorageUrl,
  sanitizeFileName,
  uploadToStorage,
} from '../../../lib/file-helpers';

export type UploadedAttachmentResult = {
  success: true;
  path: string;
  /** Signed URL (attachments bucket is private). */
  url: string;
};

/**
 * Upload one file to the attachments bucket and return path + signed URL.
 * Stateless helpers — safe under concurrent requests.
 */
export async function uploadAttachmentFile(
  file: Express.Multer.File
): Promise<UploadedAttachmentResult> {
  const bucket = env.STORAGE_BUCKET_ATTACHMENTS;
  const safeName = sanitizeFileName(file.originalname);
  const path = `${Date.now()}-${safeName}`;

  const uploaded = await uploadToStorage({
    bucket,
    path,
    buffer: file.buffer,
    contentType: file.mimetype,
  });

  const url = await createSignedStorageUrl(bucket, uploaded.path);

  return {
    success: true,
    path: uploaded.path,
    url,
  };
}
