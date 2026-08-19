import { apiFetch } from '@/lib/api/api-client';
import { createCommentsService } from './comments.service.base';

const service = createCommentsService(apiFetch);

export const createComment = service.createComment;
export const updateComment = service.updateComment;
export const forceUpdateComment = service.forceUpdateComment;
export const archiveComment = service.archiveComment;
export const restoreComment = service.restoreComment;

export type {
  CommentUser,
  CommentWorkItem,
  CommentWorkItemOption,
  CommentWorkItemOptionRow,
  CommentItem,
  CreateCommentInput,
} from './comments.service.base';

export { mapCommentWorkItemOption } from './comments.service.base';
