import {
  getPublicStorageUrl,
  removeStorageObjects,
  sanitizeFileName,
  storagePathFromPublicUrl,
  uploadToStorage,
} from './file-helpers';

export const PUBLIC_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

export type PublicImageUploadResult = {
  readonly url: string;
  readonly path: string;
};

/**
 * Upload a public branding/profile image, then run the caller DB update.
 * On DB failure, removes the new object. On success, best-effort removes the
 * previous public URL's object when it lives in the same bucket.
 */
export async function uploadPublicImageReplacingPrevious(options: {
  readonly file: Express.Multer.File;
  readonly bucket: string;
  readonly ownerKey: string;
  readonly fileNameFallback: string;
  readonly previousPublicUrl: string | null | undefined;
  readonly persistUrl: (publicUrl: string) => Promise<void>;
}): Promise<PublicImageUploadResult> {
  if (!PUBLIC_IMAGE_MIME_TYPES.has(options.file.mimetype)) {
    throw new Error('Invalid file type. Use JPEG, PNG, WebP, or GIF.');
  }

  const safeName = sanitizeFileName(
    options.file.originalname,
    options.fileNameFallback
  );
  const objectPath = `${options.ownerKey}/${Date.now()}-${safeName}`;

  const uploaded = await uploadToStorage({
    bucket: options.bucket,
    path: objectPath,
    buffer: options.file.buffer,
    contentType: options.file.mimetype,
  });

  const publicUrl = getPublicStorageUrl(options.bucket, uploaded.path);

  try {
    await options.persistUrl(publicUrl);
  } catch (error) {
    await removeStorageObjects(options.bucket, [uploaded.path]);
    throw error;
  }

  if (options.previousPublicUrl) {
    const previousPath = storagePathFromPublicUrl(
      options.previousPublicUrl,
      options.bucket
    );
    if (previousPath && previousPath !== uploaded.path) {
      await removeStorageObjects(options.bucket, [previousPath]);
    }
  }

  return { url: publicUrl, path: uploaded.path };
}
