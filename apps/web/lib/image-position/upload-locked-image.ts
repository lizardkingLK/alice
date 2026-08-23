import { apiFetch } from '@/lib/api/api-client';
import { readApiLockConflict } from '@/lib/optimistic-lock/errors';

export type LockedImageUploadConflict = {
  readonly kind: 'conflict';
  readonly updatedAt?: string | null;
  readonly message: string;
};

export type LockedImageUploadFailure = {
  readonly kind: 'error';
  readonly message: string;
};

export type LockedImageUploadSuccess<TResult> = {
  readonly kind: 'success';
  readonly result: TResult;
};

export type LockedImageUploadOutcome<TResult> =
  | LockedImageUploadSuccess<TResult>
  | LockedImageUploadConflict
  | LockedImageUploadFailure;

/**
 * POST multipart image with optimistic-lock timestamp. Shared by profile and
 * project branding uploads (not work-item attachments).
 */
export async function uploadLockedImage<TResult>(options: {
  readonly path: string;
  readonly file: File;
  readonly expectedUpdatedAt: string;
  readonly conflictMessage: string;
  readonly failureFallback: string;
}): Promise<LockedImageUploadOutcome<TResult>> {
  try {
    const formData = new FormData();
    formData.append('file', options.file);
    formData.append('expectedUpdatedAt', options.expectedUpdatedAt);
    const result = await apiFetch<TResult>(options.path, {
      method: 'POST',
      body: formData,
    });
    return { kind: 'success', result };
  } catch (uploadError) {
    const conflict = readApiLockConflict(uploadError);
    if (conflict) {
      return {
        kind: 'conflict',
        updatedAt: conflict.updatedAt,
        message: options.conflictMessage,
      };
    }
    return {
      kind: 'error',
      message:
        uploadError instanceof Error
          ? uploadError.message
          : options.failureFallback,
    };
  }
}
