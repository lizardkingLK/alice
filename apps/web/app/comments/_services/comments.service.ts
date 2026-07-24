import { apiFetch } from '@/lib/api/api-client';
import { createCommentsService } from './comments.service.base';

const service = createCommentsService(apiFetch);

export const getCommentsList = service.getCommentsList;
export const createComment = service.createComment;
export const updateComment = service.updateComment;
export const archiveComment = service.archiveComment;
export const restoreComment = service.restoreComment;

export type {
  CommentUser,
  CommentWorkItem,
  CommentItem,
  CreateCommentInput,
} from './comments.service.base';
