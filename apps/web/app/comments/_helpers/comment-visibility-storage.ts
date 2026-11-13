import { getLocalStorageJson, setLocalStorageJson } from '@/lib/local-storage';
import { extractAgentMentionsFromDoc } from '@/app/comments/_helpers/comment-agent-mentions';
import type { CommentItem } from '@/app/comments/_services/comments.mutations.shared';

const STORAGE_PREFIX = 'alice:hidden-ai-comments:v1:';

export function hiddenCommentsStorageKey(userId: string): string {
  return `${STORAGE_PREFIX}${userId}`;
}

/** Read the set of comment IDs privately hidden by the given user. */
export function readHiddenCommentIds(
  userId: string | null | undefined
): Set<string> {
  if (!userId) {
    return new Set<string>();
  }
  const parsed = getLocalStorageJson<unknown>(hiddenCommentsStorageKey(userId));
  if (Array.isArray(parsed)) {
    const stringIds = parsed.filter(
      (item): item is string => typeof item === 'string' && item.length > 0
    );
    return new Set(stringIds);
  }
  return new Set<string>();
}

/** Write the set of comment IDs privately hidden by the given user. */
export function writeHiddenCommentIds(
  userId: string | null | undefined,
  ids: Set<string> | string[]
): void {
  if (!userId) {
    return;
  }
  const array = Array.from(ids);
  setLocalStorageJson(hiddenCommentsStorageKey(userId), array);
}

/** Add a comment ID to the user's hidden set and persist. */
export function hideCommentForUser(
  userId: string | null | undefined,
  commentId: string
): Set<string> {
  const current = readHiddenCommentIds(userId);
  current.add(commentId);
  writeHiddenCommentIds(userId, current);
  return current;
}

/** Remove a comment ID from the user's hidden set and persist. */
export function unhideCommentForUser(
  userId: string | null | undefined,
  commentId: string
): Set<string> {
  const current = readHiddenCommentIds(userId);
  current.delete(commentId);
  writeHiddenCommentIds(userId, current);
  return current;
}

/** Determine whether a comment constitutes an AI discussion item. */
export function isAiDiscussionComment(
  comment: CommentItem,
  parentComment?: CommentItem | null
): boolean {
  if (extractAgentMentionsFromDoc(comment.content).length > 0) {
    return true;
  }
  if (
    parentComment &&
    extractAgentMentionsFromDoc(parentComment.content).length > 0
  ) {
    return true;
  }
  return false;
}

/**
 * Check if the active user is authorized to hide this discussion item.
 * Requires ownership (author of the item) and AI discussion scope.
 */
export function canUserHideComment(
  comment: CommentItem,
  activeUserId?: string | null,
  parentComment?: CommentItem | null
): boolean {
  if (!activeUserId || comment.author_id !== activeUserId) {
    return false;
  }
  return isAiDiscussionComment(comment, parentComment);
}

/**
 * Filter comments based on per-user hidden IDs:
 * - When showHidden is false:
 *   - If a parent comment is hidden, hide the parent AND its entire thread (all replies).
 *   - If a reply is hidden, hide only that reply.
 * - When showHidden is true:
 *   - Returns all comments so hidden items can be rendered with indicator and unhide controls.
 * - Never modifies underlying comment data.
 */
export function filterVisibleComments(
  comments: CommentItem[],
  hiddenCommentIds: Set<string>,
  showHidden = false
): CommentItem[] {
  if (showHidden || hiddenCommentIds.size === 0) {
    return comments;
  }

  return comments.filter((comment) => {
    // If this comment itself is hidden, exclude it
    if (hiddenCommentIds.has(comment.id)) {
      return false;
    }
    // If this comment is a reply and its parent is hidden, exclude it
    if (comment.parent_id && hiddenCommentIds.has(comment.parent_id)) {
      return false;
    }
    return true;
  });
}
