import { supabase } from '@/lib/supabase';

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

export const DEFAULT_SIGNED_URL_SECONDS = 60 * 60;

export type CreateSignedUrlOptions = {
  expiresInSeconds?: number;
  /** When set, browser treats the URL as a download (`true` or custom filename). */
  download?: boolean | string;
};

/** Sanitize an original filename for Storage object keys. */
export function sanitizeFileName(
  originalName: string,
  fallback = 'file'
): string {
  const base = originalName.split(/[/\\]/).pop() ?? fallback;
  const cleaned = base.replaceAll(/[^\w.-]+/g, '_').slice(0, 120);
  return cleaned.length > 0 ? cleaned : fallback;
}

/** ISO timestamp when a signed URL minted now will expire. */
export function signedUrlExpiresAt(
  expiresInSeconds: number = DEFAULT_SIGNED_URL_SECONDS
): string {
  return new Date(Date.now() + expiresInSeconds * 1000).toISOString();
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
  expiresInSecondsOrOptions:
    number | CreateSignedUrlOptions = DEFAULT_SIGNED_URL_SECONDS
): Promise<string> {
  const options =
    typeof expiresInSecondsOrOptions === 'number'
      ? { expiresInSeconds: expiresInSecondsOrOptions }
      : expiresInSecondsOrOptions;
  const expiresIn = options.expiresInSeconds ?? DEFAULT_SIGNED_URL_SECONDS;

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn, {
      download: options.download,
    });

  if (error || !data?.signedUrl) {
    console.error(
      'error. failed to create signed URL:',
      error?.message ?? 'missing url'
    );
    throw new Error('Failed to create file URL.');
  }

  return data.signedUrl;
}

/**
 * Whether a Storage object exists. Fails open (returns `true`) on transient
 * list errors so a flaky check never wrongly flags a file as missing.
 */
export async function storageObjectExists(
  bucket: string,
  path: string
): Promise<boolean> {
  const lastSlash = path.lastIndexOf('/');
  const dir = lastSlash === -1 ? '' : path.slice(0, lastSlash);
  const name = lastSlash === -1 ? path : path.slice(lastSlash + 1);

  const { data, error } = await supabase.storage.from(bucket).list(dir, {
    search: name,
    limit: 100,
  });

  if (error) {
    console.warn(
      'warn. failed to check storage object existence:',
      error.message
    );
    return true;
  }

  return Boolean(data?.some((object) => object.name === name));
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
