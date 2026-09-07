import type { Database } from '@repo/types';
import {
  ChatAttachmentFileTypeEnum,
  type ChatAttachmentWire,
} from '@repo/types';
import type { SupabaseClient } from '@supabase/supabase-js';
import { env } from '../../../config/env';
import { prisma } from '../../../lib/prisma';
import { sanitizeFileName } from '../../../lib/file-helpers';
import { sanitizeLog } from './chat.utils';

export interface UploadChatAttachmentParameters {
  readonly userId: string;
  readonly conversationId?: string;
  readonly fileName: string;
  readonly fileBuffer: Buffer;
  readonly mimeType: string;
  readonly fileSize: number;
}

export function detectChatAttachmentFileType(
  fileName: string,
  mimeType: string
): ChatAttachmentFileTypeEnum {
  const normalizedFileName = fileName.toLowerCase();
  const normalizedMimeType = mimeType.toLowerCase();

  if (
    normalizedFileName.endsWith('.json') ||
    normalizedMimeType.includes('application/json')
  ) {
    return ChatAttachmentFileTypeEnum.Json;
  }

  if (
    normalizedFileName.endsWith('.csv') ||
    normalizedMimeType.includes('text/csv') ||
    normalizedMimeType.includes('application/csv') ||
    normalizedMimeType.includes('text/comma-separated-values')
  ) {
    return ChatAttachmentFileTypeEnum.Csv;
  }

  if (
    normalizedFileName.endsWith('.txt') ||
    normalizedFileName.endsWith('.md') ||
    normalizedMimeType.startsWith('text/')
  ) {
    return ChatAttachmentFileTypeEnum.Text;
  }

  if (
    normalizedMimeType.startsWith('image/') ||
    normalizedFileName.endsWith('.png') ||
    normalizedFileName.endsWith('.jpg') ||
    normalizedFileName.endsWith('.jpeg') ||
    normalizedFileName.endsWith('.webp')
  ) {
    return ChatAttachmentFileTypeEnum.Image;
  }

  return ChatAttachmentFileTypeEnum.Other;
}

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

      const bucketExists = buckets.some(
        (bucket) => bucket.name === bucketName
      );
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

  async uploadAttachment(
    parameters: UploadChatAttachmentParameters
  ): Promise<ChatAttachmentWire> {
    const {
      userId,
      conversationId,
      fileName,
      fileBuffer,
      mimeType,
      fileSize,
    } = parameters;

    const bucketName = await this.ensureChatAttachmentsBucketExists();
    const safeFileName = sanitizeFileName(fileName);
    const storagePath = `chat-attachments/${userId}/${Date.now()}-${safeFileName}`;

    const { error: uploadError } = await this.supabaseClient.storage
      .from(bucketName)
      .upload(storagePath, fileBuffer, {
        contentType: mimeType || 'application/octet-stream',
        upsert: false,
      });

    if (uploadError) {
      console.error(
        'Failed to upload chat attachment to storage:',
        sanitizeLog(uploadError.message)
      );
      throw new Error('Failed to upload attachment file to storage.');
    }

    const twentyFourHoursInSeconds = 24 * 60 * 60;
    const { data: signedData, error: signedError } =
      await this.supabaseClient.storage
        .from(bucketName)
        .createSignedUrl(storagePath, twentyFourHoursInSeconds);

    if (signedError || !signedData?.signedUrl) {
      throw new Error('Failed to create signed URL for attachment.');
    }

    const detectedFileType = detectChatAttachmentFileType(fileName, mimeType);

    const attachmentRecord = await prisma.chat_attachments.create({
      data: {
        user_id: userId,
        conversation_id: conversationId || null,
        file_name: fileName,
        storage_path: storagePath,
        file_size: fileSize,
        mime_type: mimeType,
      },
    });

    return {
      id: attachmentRecord.id,
      fileName: attachmentRecord.file_name,
      fileSize: attachmentRecord.file_size,
      mimeType: attachmentRecord.mime_type,
      storagePath: attachmentRecord.storage_path,
      url: signedData.signedUrl,
      fileType: detectedFileType,
    };
  }

  async getAttachmentById(
    attachmentId: string
  ): Promise<ChatAttachmentWire | null> {
    const attachmentRecord = await prisma.chat_attachments.findUnique({
      where: { id: attachmentId },
    });

    if (!attachmentRecord || attachmentRecord.status !== 'active') {
      return null;
    }

    const bucketName = await this.ensureChatAttachmentsBucketExists();
    const twentyFourHoursInSeconds = 24 * 60 * 60;
    const { data: signedData, error: signedError } =
      await this.supabaseClient.storage
        .from(bucketName)
        .createSignedUrl(
          attachmentRecord.storage_path,
          twentyFourHoursInSeconds
        );

    if (signedError || !signedData?.signedUrl) {
      return null;
    }

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
      url: signedData.signedUrl,
      fileType: detectedFileType,
    };
  }

  async deleteAttachment(
    userId: string,
    attachmentId: string
  ): Promise<boolean> {
    const attachmentRecord = await prisma.chat_attachments.findUnique({
      where: { id: attachmentId },
    });

    if (!attachmentRecord) {
      return false;
    }

    if (attachmentRecord.user_id !== userId) {
      throw new Error('Access denied: You do not own this attachment.');
    }

    const bucketName = await this.ensureChatAttachmentsBucketExists();

    await this.supabaseClient.storage
      .from(bucketName)
      .remove([attachmentRecord.storage_path]);

    await prisma.chat_attachments.delete({
      where: { id: attachmentId },
    });

    return true;
  }
}
