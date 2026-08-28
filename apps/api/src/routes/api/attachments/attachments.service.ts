import { env } from '../../../config/env';
import {
  createSignedStorageUrl,
  createSignedStorageUploadUrl,
  DEFAULT_SIGNED_URL_SECONDS,
  removeStorageObjects,
  sanitizeFileName,
  signedUrlExpiresAt,
  storageObjectExistsStrict,
  storageObjectExists,
  uploadToStorage,
} from '../../../lib/file-helpers';
import type {
  AttachmentListRow,
  AttachmentSignedUrls,
  AttachmentUploadSession,
  UploadedAttachmentResult,
} from '@repo/types';
import type { WorkItemRepository } from '../workItems/workItems.repository';
import { AttachmentsRepository } from './attachments.repository';

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

type WorkItemAccess = Pick<WorkItemRepository, 'requireProjectMember'>;

/**
 * Upload one file to the attachments bucket.
 * When `workItemId` is set, also inserts an `attachments` row (details upload).
 * Without it, storage-only (playground `/files` page).
 */
export class AttachmentsService {
  constructor(
    private readonly attachmentsRepository: AttachmentsRepository,
    private readonly workItems: WorkItemAccess
  ) {}

  /** Unused Express list path — requires project membership for the work item. */
  async listByWorkItemId(
    workItemId: string,
    actorId: string
  ): Promise<AttachmentListRow[]> {
    await this.workItems.requireProjectMember(workItemId, actorId);
    return await this.attachmentsRepository.listByWorkItemId(workItemId);
  }

  async uploadAttachmentFile(
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
      const exists =
        await this.attachmentsRepository.workItemExists(workItemId);
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

      const attachment = await this.attachmentsRepository.create({
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

  async createAttachmentUploadSession(params: {
    workItemId?: string;
    fileName: string;
    contentType: string;
    fileSize: number;
  }): Promise<AttachmentUploadSession> {
    const { workItemId, fileName } = params;
    const bucket = env.STORAGE_BUCKET_ATTACHMENTS;

    const safeName = sanitizeFileName(fileName);
    const path = workItemId
      ? `${workItemId}/${Date.now()}-${safeName}`
      : `${Date.now()}-${safeName}`;

    if (workItemId) {
      const exists =
        await this.attachmentsRepository.workItemExists(workItemId);
      if (!exists) {
        throw new Error('Work item not found');
      }
    }

    const { signedUrl, token } = await createSignedStorageUploadUrl(
      bucket,
      path
    );

    return {
      upload: {
        bucket,
        signedUrl,
        token,
        path,
      },
    };
  }

  async finalizeAttachmentUpload(params: {
    actorId: string;
    workItemId?: string;
    storagePath: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
  }): Promise<UploadedAttachmentResult> {
    const { actorId, workItemId, storagePath, fileName, fileSize, mimeType } =
      params;

    const bucket = env.STORAGE_BUCKET_ATTACHMENTS;

    if (workItemId && !storagePath.startsWith(`${workItemId}/`)) {
      throw new Error('Invalid upload target');
    }

    const exists = await storageObjectExistsStrict(bucket, storagePath);
    if (!exists) {
      throw new Error('Uploaded file not found in storage');
    }

    const url = await createSignedStorageUrl(bucket, storagePath);

    if (!workItemId) {
      return { success: true, path: storagePath, url };
    }

    const attachment = await this.attachmentsRepository.create({
      work_item_id: workItemId,
      uploader_id: actorId,
      file_name: fileName,
      storage_path: storagePath,
      file_size: fileSize,
      mime_type: mimeType || 'application/octet-stream',
    });

    return {
      success: true,
      path: storagePath,
      url,
      attachment,
    };
  }

  /** Mint preview + download signed URLs for an active attachment. */
  async getAttachmentSignedUrls(
    attachmentId: string
  ): Promise<AttachmentSignedUrls> {
    const attachment = await this.attachmentsRepository.getById(attachmentId);
    if (attachment?.status !== 'active') {
      throw new AttachmentNotFoundError();
    }

    const bucket = env.STORAGE_BUCKET_ATTACHMENTS;

    const objectExists = await storageObjectExists(
      bucket,
      attachment.storage_path
    );
    if (!objectExists) {
      throw new AttachmentGoneError();
    }

    const expiresInSeconds = DEFAULT_SIGNED_URL_SECONDS;

    const [previewUrl, downloadUrl] = await Promise.all([
      createSignedStorageUrl(bucket, attachment.storage_path, {
        expiresInSeconds,
      }),
      createSignedStorageUrl(bucket, attachment.storage_path, {
        expiresInSeconds,
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
  async deleteAttachment(
    attachmentId: string,
    actorId: string,
    expectedUpdatedAt: string
  ): Promise<void> {
    const attachment = await this.attachmentsRepository.getById(attachmentId);
    if (attachment?.status !== 'active') {
      throw new AttachmentNotFoundError();
    }

    await this.attachmentsRepository.archive(
      attachmentId,
      actorId,
      expectedUpdatedAt
    );
    await removeStorageObjects(env.STORAGE_BUCKET_ATTACHMENTS, [
      attachment.storage_path,
    ]);
  }
}
