import type {
  CommentItem,
  CommentRowFields,
  CommentUser,
} from '@/app/comments/_services/comments.mutations.shared';
import { isNewerUpdatedAt } from '@/app/board/_helpers/board-move-pending';
import {
  resolveRealtimeUserLookup,
  type RealtimeUserLookup,
} from '@/lib/realtime/realtime-user-lookup';
import type { ScopedRealtimeEvent } from '@/lib/realtime/use-scoped-table-realtime';
import type { Json } from '@repo/types';

export type CommentRealtimeRow = CommentRowFields;

export type CommentAuthorLookup = RealtimeUserLookup;

function toCommentItem(
  row: CommentRealtimeRow,
  users: readonly CommentAuthorLookup[],
  previous?: CommentItem
): CommentItem {
  const resolved = resolveRealtimeUserLookup(row.author_id, users);
  const author: CommentUser = {
    id: resolved.id,
    name: resolved.name,
    email: resolved.email,
    profile_picture: resolved.profile_picture,
  };

  return {
    id: row.id,
    work_item_id: row.work_item_id,
    author_id: row.author_id,
    parent_id: row.parent_id,
    content: row.content as Json,
    reactions: (row.reactions ?? []) as Json,
    edited: row.edited,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
    author,
    work_item: previous?.work_item ?? null,
    replies: previous?.replies,
  };
}

function isValidUpsertRow(
  row: Partial<CommentRealtimeRow>
): row is CommentRealtimeRow {
  return (
    typeof row.id === 'string' &&
    typeof row.work_item_id === 'string' &&
    typeof row.author_id === 'string' &&
    row.content !== undefined &&
    typeof row.created_at === 'string' &&
    typeof row.updated_at === 'string'
  );
}

function replaceCommentAt(
  comments: readonly CommentItem[],
  index: number,
  nextItem: CommentItem
): CommentItem[] {
  const next = [...comments];
  next[index] = nextItem;
  return next;
}

function applyUpsertIfNewer(
  comments: readonly CommentItem[],
  index: number,
  fullRow: CommentRealtimeRow,
  users: readonly CommentAuthorLookup[]
): CommentItem[] | null {
  if (index < 0) {
    return [toCommentItem(fullRow, users), ...comments];
  }

  const current = comments[index]!;
  if (!isNewerUpdatedAt(fullRow.updated_at, current.updated_at)) {
    return null;
  }

  return replaceCommentAt(
    comments,
    index,
    toCommentItem(fullRow, users, current)
  );
}

export type ApplyRealtimeCommentOptions = {
  /**
   * When true for a comment id, keep local `reactions` (pending optimistic
   * flush) instead of applying the channel payload's reactions.
   */
  // eslint-disable-next-line no-unused-vars -- predicate
  isReactionFlushPending?: (commentId: string) => boolean;
};

/**
 * Merge a comments postgres_changes payload into the local feed list.
 * Returns null when the list is unchanged (echo / stale / invalid).
 */
export function applyRealtimeCommentChange(
  comments: readonly CommentItem[],
  eventType: ScopedRealtimeEvent,
  row: Partial<CommentRealtimeRow> | null,
  users: readonly CommentAuthorLookup[] = [],
  options: ApplyRealtimeCommentOptions = {}
): CommentItem[] | null {
  if (eventType === 'DELETE') {
    const id = row?.id;
    if (!id) {
      return null;
    }
    const next = comments.filter((comment) => comment.id !== id);
    return next.length === comments.length ? null : next;
  }

  if (!row || !isValidUpsertRow(row)) {
    return null;
  }

  const index = comments.findIndex((comment) => comment.id === row.id);
  const existing = index >= 0 ? comments[index] : undefined;
  const skipReactions =
    Boolean(options.isReactionFlushPending?.(row.id)) && Boolean(existing);

  const fullRow: CommentRealtimeRow = {
    ...row,
    reactions: skipReactions
      ? (existing!.reactions ?? [])
      : (row.reactions ?? existing?.reactions ?? []),
  };

  if (eventType === 'INSERT' && index < 0) {
    return [toCommentItem(fullRow, users), ...comments];
  }

  return applyUpsertIfNewer(comments, index, fullRow, users);
}
