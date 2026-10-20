import type {
  CommentItem,
  CommentUser,
} from '@/app/comments/_services/comments.mutations.shared';
import { isNewerUpdatedAt } from '@/app/board/_helpers/board-move-pending';
import {
  resolveRealtimeUserLookup,
  type RealtimeUserLookup,
} from '@/lib/realtime/realtime-user-lookup';
import type { ScopedRealtimeEvent } from '@/lib/realtime/use-scoped-table-realtime';
import type { Json, Tables } from '@repo/types';

export type CommentRealtimeRow = Pick<
  Tables<'comments'>,
  | 'id'
  | 'work_item_id'
  | 'author_id'
  | 'parent_id'
  | 'content'
  | 'edited'
  | 'status'
  | 'created_at'
  | 'updated_at'
>;

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
    edited: row.edited,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
    author,
    work_item: previous?.work_item ?? null,
    replies: previous?.replies,
  };
}

/**
 * Merge a comments postgres_changes payload into the local feed list.
 * Returns null when the list is unchanged (echo / stale / invalid).
 */
export function applyRealtimeCommentChange(
  comments: readonly CommentItem[],
  eventType: ScopedRealtimeEvent,
  row: Partial<CommentRealtimeRow> | null,
  users: readonly CommentAuthorLookup[] = []
): CommentItem[] | null {
  if (eventType === 'DELETE') {
    const id = row?.id;
    if (!id) {
      return null;
    }
    const next = comments.filter((comment) => comment.id !== id);
    return next.length === comments.length ? null : next;
  }

  if (!row?.id || typeof row.id !== 'string') {
    return null;
  }
  if (
    typeof row.work_item_id !== 'string' ||
    typeof row.author_id !== 'string' ||
    row.content === undefined ||
    typeof row.created_at !== 'string' ||
    typeof row.updated_at !== 'string'
  ) {
    return null;
  }

  const fullRow = row as CommentRealtimeRow;
  const index = comments.findIndex((comment) => comment.id === fullRow.id);

  if (eventType === 'INSERT') {
    if (index >= 0) {
      // Own create already applied; refresh if channel row is newer.
      const current = comments[index]!;
      if (!isNewerUpdatedAt(fullRow.updated_at, current.updated_at)) {
        return null;
      }
      const next = [...comments];
      next[index] = toCommentItem(fullRow, users, current);
      return next;
    }
    return [toCommentItem(fullRow, users), ...comments];
  }

  // UPDATE
  if (index < 0) {
    return [toCommentItem(fullRow, users), ...comments];
  }
  const current = comments[index]!;
  if (!isNewerUpdatedAt(fullRow.updated_at, current.updated_at)) {
    return null;
  }
  const next = [...comments];
  next[index] = toCommentItem(fullRow, users, current);
  return next;
}
