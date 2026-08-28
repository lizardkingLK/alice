import type { AttachmentListRow } from '@repo/types';
import { TEST_USER } from './user.fixture';

export function createAttachmentListRow(
  overrides: Partial<AttachmentListRow> = {}
): AttachmentListRow {
  return {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    work_item_id: '22222222-2222-4222-8222-222222222222',
    file_name: 'spec.pdf',
    file_size: 1024,
    mime_type: 'application/pdf',
    storage_path: '22222222-2222-4222-8222-222222222222/123-spec.pdf',
    created_at: new Date('2026-08-01T00:00:00.000Z'),
    updated_at: new Date('2026-08-01T00:00:00.000Z'),
    uploader_id: TEST_USER.id,
    status: 'active',
    created_by: TEST_USER.id,
    updated_by: TEST_USER.id,
    uploader: TEST_USER,
    ...overrides,
  };
}
