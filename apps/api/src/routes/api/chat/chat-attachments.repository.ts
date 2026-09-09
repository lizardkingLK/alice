import {
  detectChatAttachmentFileType,
  type ChatAttachmentSignedUrls,
  type ChatAttachmentUploadSession,
  type ChatAttachmentWire,
  type Database,
  type UploadedChatAttachmentResult,
} from '@repo/types';
import type { SupabaseClient } from '@supabase/supabase-js';
import { env } from '../../../config/env';
import { prisma } from '../../../lib/prisma';
import {
  createSignedStorageUploadUrl,
  createSignedStorageUrl,
  DEFAULT_SIGNED_URL_SECONDS,
  removeStorageObjects,
  sanitizeFileName,
  signedUrlExpiresAt,
  storageObjectExists,
  storageObjectExistsStrict,
  uploadToStorage,
} from '../../../lib/file-helpers';
import { sanitizeLog } from './chat.utils';

export { detectChatAttachmentFileType } from '@repo/types';

export interface UploadChatAttachmentParameters {
  readonly userId: string;
  readonly conversationId?: string;
  readonly fileName: string;
  readonly fileBuffer: Buffer;
  readonly mimeType: string;
  readonly fileSize: number;
}

export interface CreateChatAttachmentUploadSessionParameters {
  readonly userId: string;
  readonly conversationId?: string;
  readonly fileName: string;
  readonly contentType: string;
  readonly fileSize: number;
}

export interface FinalizeChatAttachmentUploadParameters {
  readonly userId: string;
  readonly conversationId?: string;
  readonly storagePath: string;
  readonly fileName: string;
  readonly fileSize: number;
  readonly mimeType: string;
}

const TWENTY_FOUR_HOURS_IN_SECONDS = 24 * 60 * 60;

export class ChatAttachmentsRepository {
  private isBucketVerified = false;

  constructor(private readonly supabaseClient: SupabaseClient<Database>) {}

  async ensureChatAttachmentsBucketExists(): Promise<string> {
    const bucketName = env.STORAGE_BUCKET_CHAT_ATTACHMENTS;
    if (this.isBucketVerified) {
      return bucketName;
    }

    try {
      const { data: buckets, error: listError } =
        await this.supabaseClient.storage.listBuckets();
      if (listError) {
        throw listError;
      }

      const bucketExists = buckets.some((bucket) => bucket.name === bucketName);
      if (!bucketExists) {
        const { error: createError } =
          await this.supabaseClient.storage.createBucket(bucketName, {
            public: false,
          });
        if (createError) {
          throw createError;
        }
      }
      this.isBucketVerified = true;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(
        `Error verifying/creating chat attachments storage bucket "${sanitizeLog(bucketName)}":`,
        sanitizeLog(errorMessage)
      );
    }

    return bucketName;
  }

  async createUploadSession(
    params: CreateChatAttachmentUploadSessionParameters
  ): Promise<ChatAttachmentUploadSession> {
    const { userId, conversationId, fileName } = params;
    const bucketName = await this.ensureChatAttachmentsBucketExists();

    if (conversationId) {
      const conversation = await prisma.chat_conversations.findFirst({
        where: { id: conversationId, user_id: userId },
        select: { id: true },
      });
      if (!conversation) {
        throw new Error('Conversation not found');
      }
    }

    const safeFileName = sanitizeFileName(fileName);
    const storagePath = `chat-attachments/${userId}/${Date.now()}-${safeFileName}`;

    const { signedUrl, token } = await createSignedStorageUploadUrl(
      bucketName,
      storagePath
    );

    return {
      upload: {
        bucket: bucketName,
        signedUrl,
        token,
        path: storagePath,
      },
    };
  }

  async finalizeUpload(
    params: FinalizeChatAttachmentUploadParameters
  ): Promise<UploadedChatAttachmentResult> {
    const {
      userId,
      conversationId,
      storagePath,
      fileName,
      fileSize,
      mimeType,
    } = params;

    const bucketName = await this.ensureChatAttachmentsBucketExists();

    if (!storagePath.startsWith(`chat-attachments/${userId}/`)) {
      throw new Error('Invalid upload target');
    }

    if (conversationId) {
      const conversation = await prisma.chat_conversations.findFirst({
        where: { id: conversationId, user_id: userId },
        select: { id: true },
      });
      if (!conversation) {
        throw new Error('Conversation not found');
      }
    }

    const exists = await storageObjectExistsStrict(bucketName, storagePath);
    if (!exists) {
      throw new Error('Uploaded file not found in storage');
    }

    const url = await createSignedStorageUrl(
      bucketName,
      storagePath,
      TWENTY_FOUR_HOURS_IN_SECONDS
    );

    const detectedFileType = detectChatAttachmentFileType(fileName, mimeType);

    const attachmentRecord = await prisma.chat_attachments.create({
      data: {
        user_id: userId,
        conversation_id: conversationId || null,
        file_name: fileName,
        storage_path: storagePath,
        file_size: fileSize,
        mime_type: mimeType || 'application/octet-stream',
        status: 'active',
      },
    });

    const attachment: ChatAttachmentWire = {
      id: attachmentRecord.id,
      fileName: attachmentRecord.file_name,
      fileSize: attachmentRecord.file_size,
      mimeType: attachmentRecord.mime_type,
      storagePath: attachmentRecord.storage_path,
      url,
      fileType: detectedFileType,
    };

    return {
      success: true,
      path: storagePath,
      url,
      attachment,
    };
  }

  async uploadAttachment(
    parameters: UploadChatAttachmentParameters
  ): Promise<ChatAttachmentWire> {
    const { userId, conversationId, fileName, fileBuffer, mimeType, fileSize } =
      parameters;

    const bucketName = await this.ensureChatAttachmentsBucketExists();

    if (conversationId) {
      const conversation = await prisma.chat_conversations.findFirst({
        where: { id: conversationId, user_id: userId },
        select: { id: true },
      });
      if (!conversation) {
        throw new Error('Conversation not found');
      }
    }

    const safeFileName = sanitizeFileName(fileName);
    const storagePath = `chat-attachments/${userId}/${Date.now()}-${safeFileName}`;

    const uploaded = await uploadToStorage({
      bucket: bucketName,
      path: storagePath,
      buffer: fileBuffer,
      contentType: mimeType || 'application/octet-stream',
    });

    try {
      const url = await createSignedStorageUrl(
        bucketName,
        uploaded.path,
        TWENTY_FOUR_HOURS_IN_SECONDS
      );

      const detectedFileType = detectChatAttachmentFileType(fileName, mimeType);

      const attachmentRecord = await prisma.chat_attachments.create({
        data: {
          user_id: userId,
          conversation_id: conversationId || null,
          file_name: fileName,
          storage_path: uploaded.path,
          file_size: fileSize,
          mime_type: mimeType || 'application/octet-stream',
          status: 'active',
        },
      });

      return {
        id: attachmentRecord.id,
        fileName: attachmentRecord.file_name,
        fileSize: attachmentRecord.file_size,
        mimeType: attachmentRecord.mime_type,
        storagePath: attachmentRecord.storage_path,
        url,
        fileType: detectedFileType,
      };
    } catch (error) {
      await removeStorageObjects(bucketName, [uploaded.path]);
      throw error;
    }
  }

  async getAttachmentById(
    attachmentId: string
  ): Promise<ChatAttachmentWire | null> {
    const attachmentRecord = await prisma.chat_attachments.findUnique({
      where: { id: attachmentId },
    });

    if (attachmentRecord?.status !== 'active') {
      return null;
    }

    const bucketName = await this.ensureChatAttachmentsBucketExists();
    const objectExists = await storageObjectExists(
      bucketName,
      attachmentRecord.storage_path
    );
    if (!objectExists) {
      return null;
    }

    const url = await createSignedStorageUrl(
      bucketName,
      attachmentRecord.storage_path,
      TWENTY_FOUR_HOURS_IN_SECONDS
    );

    const detectedFileType = detectChatAttachmentFileType(
      attachmentRecord.file_name,
      attachmentRecord.mime_type
    );

    return {
      id: attachmentRecord.id,
      fileName: attachmentRecord.file_name,
      fileSize: attachmentRecord.file_size,
      mimeType: attachmentRecord.mime_type,
      storagePath: attachmentRecord.storage_path,
      url,
      fileType: detectedFileType,
    };
  }

  async getAttachmentSignedUrls(
    attachmentId: string
  ): Promise<ChatAttachmentSignedUrls> {
    const attachmentRecord = await prisma.chat_attachments.findUnique({
      where: { id: attachmentId },
    });

    if (attachmentRecord?.status !== 'active') {
      throw new Error('Attachment not found');
    }

    const bucketName = await this.ensureChatAttachmentsBucketExists();
    const objectExists = await storageObjectExists(
      bucketName,
      attachmentRecord.storage_path
    );
    if (!objectExists) {
      throw new Error('Attachment file is no longer available');
    }

    const expiresInSeconds = DEFAULT_SIGNED_URL_SECONDS;
    const [previewUrl, downloadUrl] = await Promise.all([
      createSignedStorageUrl(bucketName, attachmentRecord.storage_path, {
        expiresInSeconds,
      }),
      createSignedStorageUrl(bucketName, attachmentRecord.storage_path, {
        expiresInSeconds,
        download: sanitizeFileName(attachmentRecord.file_name),
      }),
    ]);

    return {
      previewUrl,
      downloadUrl,
      expiresAt: signedUrlExpiresAt(expiresInSeconds),
    };
  }

  async deleteAttachment(
    userId: string,
    attachmentId: string
  ): Promise<boolean> {
    const attachmentRecord = await prisma.chat_attachments.findUnique({
      where: { id: attachmentId },
    });

    if (attachmentRecord?.status !== 'active') {
      return false;
    }

    if (attachmentRecord.user_id !== userId) {
      throw new Error('Access denied: You do not own this attachment.');
    }

    const bucketName = await this.ensureChatAttachmentsBucketExists();

    await prisma.chat_attachments.update({
      where: { id: attachmentId },
      data: {
        status: 'archived',
      },
    });

    await removeStorageObjects(bucketName, [attachmentRecord.storage_path]);

    return true;
  }

  async listAttachmentsByConversation(
    userId: string,
    conversationId: string
  ): Promise<ChatAttachmentWire[]> {
    const records = await prisma.chat_attachments.findMany({
      where: {
        user_id: userId,
        conversation_id: conversationId,
        status: 'active',
      },
      orderBy: { created_at: 'desc' },
    });

    const bucketName = await this.ensureChatAttachmentsBucketExists();

    return Promise.all(
      records.map(async (record) => {
        const url = await createSignedStorageUrl(
          bucketName,
          record.storage_path,
          TWENTY_FOUR_HOURS_IN_SECONDS
        );
        return {
          id: record.id,
          fileName: record.file_name,
          fileSize: record.file_size,
          mimeType: record.mime_type,
          storagePath: record.storage_path,
          url,
          fileType: detectChatAttachmentFileType(
            record.file_name,
            record.mime_type
          ),
        };
      })
    );
  }
}
