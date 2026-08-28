import { describe, expect, it } from 'vitest';
import {
  archiveAttachmentSchema,
  createUploadSessionSchema,
  finalizeUploadSchema,
} from '@repo/types';

const WORK_ITEM_ID = '22222222-2222-4222-8222-222222222222';

describe('attachment v1 input schemas', () => {
  it('accepts create upload session payloads', () => {
    const parsed = createUploadSessionSchema.safeParse({
      work_item_id: WORK_ITEM_ID,
      file_name: 'spec.pdf',
      content_type: 'application/pdf',
      file_size: 1024,
    });

    expect(parsed.success).toBe(true);
  });

  it('rejects invalid create upload session payloads', () => {
    const parsed = createUploadSessionSchema.safeParse({
      work_item_id: WORK_ITEM_ID,
      file_name: '',
      content_type: 'application/pdf',
      file_size: 0,
    });

    expect(parsed.success).toBe(false);
  });

  it('accepts finalize upload payloads', () => {
    const parsed = finalizeUploadSchema.safeParse({
      work_item_id: WORK_ITEM_ID,
      storage_path: `${WORK_ITEM_ID}/123-spec.pdf`,
      file_name: 'spec.pdf',
      file_size: 1024,
      mime_type: 'application/pdf',
    });

    expect(parsed.success).toBe(true);
  });

  it('rejects invalid finalize upload payloads', () => {
    const parsed = finalizeUploadSchema.safeParse({
      storage_path: '',
      file_name: 'spec.pdf',
      file_size: 1024,
      mime_type: 'application/pdf',
    });

    expect(parsed.success).toBe(false);
  });

  it('accepts archive attachment payloads', () => {
    const parsed = archiveAttachmentSchema.safeParse({
      expectedUpdatedAt: '2026-08-01T00:00:00.000Z',
    });

    expect(parsed.success).toBe(true);
  });

  it('rejects invalid archive attachment payloads', () => {
    const parsed = archiveAttachmentSchema.safeParse({
      expectedUpdatedAt: 'not-a-date',
    });

    expect(parsed.success).toBe(false);
  });
});
