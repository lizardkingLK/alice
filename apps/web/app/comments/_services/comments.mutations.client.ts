import { apiFetch } from '@/lib/api/api-fetch.mutations.use.client';
import { createCommentsService } from './comments.mutations.shared';

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
} from './comments.mutations.shared';

export { mapCommentWorkItemOption } from './comments.mutations.shared';
