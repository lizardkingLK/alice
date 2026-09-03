import type { Tables } from './generated/supabase/database.types.js';
import { userRelationSelect } from './users.js';

/** Nested uploader embed on attachment selects. */
export type AttachmentUploader = {
  id: string;
  name: string;
  email: string;
  profile_picture?: string | null;
};

/**
 * Attachment row with uploader embed — shared by API repository and web SSR.
 */
export type AttachmentWithUploader = Pick<
  Tables<'attachments'>,
  | 'id'
  | 'work_item_id'
  | 'file_name'
  | 'file_size'
  | 'mime_type'
  | 'storage_path'
  | 'created_at'
  | 'updated_at'
  | 'uploader_id'
  | 'status'
  | 'created_by'
  | 'updated_by'
> & {
  uploader: AttachmentUploader | null;
};

export const ATTACHMENT_UPLOADER_SELECT = userRelationSelect(
  'uploader',
  'uploader_id'
);

/**
 * Shared PostgREST select for attachment + uploader embed.
 * Field list must stay aligned with `attachmentListSelect` in `api/v1/attachments.ts`.
 */
export const ATTACHMENT_SELECT = `
  id, work_item_id, file_name, file_size, mime_type, storage_path,
  created_at, updated_at, uploader_id, status, created_by, updated_by,
  ${ATTACHMENT_UPLOADER_SELECT}
`;
