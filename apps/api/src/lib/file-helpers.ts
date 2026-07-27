import { supabase } from './supabase';

export type StorageUploadInput = {
  bucket: string;
  path: string;
  buffer: Buffer;
  contentType: string;
  upsert?: boolean;
};

export type StorageUploadResult = {
  path: string;
};

const DEFAULT_SIGNED_URL_SECONDS = 60 * 60;

/** Sanitize an original filename for Storage object keys. */
export function sanitizeFileName(
  originalName: string,
  fallback = 'file'
): string {
  const base = originalName.split(/[/\\]/).pop() ?? fallback;
  const cleaned = base.replaceAll(/[^\w.-]+/g, '_').slice(0, 120);
  return cleaned.length > 0 ? cleaned : fallback;
}

/** Upload a buffer to a Storage bucket. Stateless — safe under concurrent requests. */
export async function uploadToStorage(
  input: StorageUploadInput
): Promise<StorageUploadResult> {
  const { data, error } = await supabase.storage
    .from(input.bucket)
    .upload(input.path, input.buffer, {
      contentType: input.contentType,
      upsert: input.upsert ?? false,
    });

  if (error) {
    console.error('error. storage upload failed:', error.message);
    throw new Error('File upload failed.');
  }

  return { path: data.path };
}

/** Forever public object URL (public buckets only). */
export function getPublicStorageUrl(bucket: string, path: string): string {
  const {
    data: { publicUrl },
  } = supabase.storage.from(bucket).getPublicUrl(path);
  return publicUrl;
}

/** Time-limited signed URL (private or public buckets). */
export async function createSignedStorageUrl(
  bucket: string,
  path: string,
  expiresInSeconds: number = DEFAULT_SIGNED_URL_SECONDS
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresInSeconds);

  if (error || !data?.signedUrl) {
    console.error(
      'error. failed to create signed URL:',
      error?.message ?? 'missing url'
    );
    throw new Error('Failed to create file URL.');
  }

  return data.signedUrl;
}

/** Best-effort delete of Storage objects. */
export async function removeStorageObjects(
  bucket: string,
  paths: string[]
): Promise<void> {
  if (paths.length === 0) {
    return;
  }

  const { error } = await supabase.storage.from(bucket).remove(paths);
  if (error) {
    console.warn('warn. failed to remove storage objects:', error.message);
  }
}

/**
 * Extract object path from a forever public Storage URL for this bucket.
 * Returns null when the URL is not from this project's public object path.
 */
export function storagePathFromPublicUrl(
  publicUrl: string,
  bucket: string
): string | null {
  const marker = `/storage/v1/object/public/${bucket}/`;
  const index = publicUrl.indexOf(marker);
  if (index === -1) {
    return null;
  }
  return decodeURIComponent(publicUrl.slice(index + marker.length));
}
