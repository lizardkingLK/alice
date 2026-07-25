import { env } from '../../../config/env';
import { filesRepository } from './files.repository';

export type UploadedFileResult = {
  success: true;
  path: string;
  /** Signed URL (attachments bucket is private). */
  url: string;
};

export class FilesService {
  async uploadAttachment(
    file: Express.Multer.File
  ): Promise<UploadedFileResult> {
    const bucket = env.STORAGE_BUCKET_ATTACHMENTS;
    const safeName = filesRepository.sanitizeFileName(file.originalname);
    const path = `${Date.now()}-${safeName}`;

    const uploaded = await filesRepository.upload({
      bucket,
      path,
      buffer: file.buffer,
      contentType: file.mimetype,
    });

    const url = await filesRepository.createSignedUrl(bucket, uploaded.path);

    return {
      success: true,
      path: uploaded.path,
      url,
    };
  }
}

export const filesService = new FilesService();
