import { z } from 'zod';

/** Curated reaction allowlist (GitHub-style). Keep small for picker performance. */
export const COMMENT_REACTION_EMOJIS = [
  '👍',
  '👎',
  '❤️',
  '🎉',
  '😄',
  '😮',
  '😢',
  '👀',
  '✅',
  '🚀',
] as const;

export type CommentReactionEmoji = (typeof COMMENT_REACTION_EMOJIS)[number];

export const commentReactionEmojiSchema = z.enum(COMMENT_REACTION_EMOJIS);

export type CommentReactionEntry = {
  user_id: string;
  emoji: CommentReactionEmoji;
};

export type CommentReactionSummary = {
  emoji: CommentReactionEmoji;
  count: number;
  includesMe: boolean;
  userIds: string[];
};

export const commentReactionActionSchema = z.enum(['add', 'remove']);

export const toggleCommentReactionSchema = z.object({
  emoji: commentReactionEmojiSchema,
  action: commentReactionActionSchema,
});

export type ToggleCommentReactionBody = z.infer<
  typeof toggleCommentReactionSchema
>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const emojiSet = new Set<string>(COMMENT_REACTION_EMOJIS);

/** Parse stored JSON into validated reaction entries (drops invalid rows). */
export function parseCommentReactions(value: unknown): CommentReactionEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  const entries: CommentReactionEntry[] = [];

  for (const item of value) {
    if (!isRecord(item)) {
      continue;
    }
    const userId = item.user_id;
    const emoji = item.emoji;
    if (typeof userId !== 'string' || userId.length === 0) {
      continue;
    }
    if (typeof emoji !== 'string' || !emojiSet.has(emoji)) {
      continue;
    }
    const key = `${userId}\0${emoji}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    entries.push({
      user_id: userId,
      emoji: emoji as CommentReactionEmoji,
    });
  }

  return entries;
}

/**
 * Merge a single user/emoji intent into the flat reactions array.
 * Idempotent: add is a no-op when present; remove is a no-op when absent.
 */
export function mergeCommentReaction(
  current: unknown,
  userId: string,
  emoji: CommentReactionEmoji,
  action: 'add' | 'remove'
): CommentReactionEntry[] {
  const entries = parseCommentReactions(current);

  if (action === 'remove') {
    return entries.filter(
      (entry) => !(entry.user_id === userId && entry.emoji === emoji)
    );
  }

  const exists = entries.some(
    (entry) => entry.user_id === userId && entry.emoji === emoji
  );
  if (exists) {
    return entries;
  }

  return [...entries, { user_id: userId, emoji }];
}

/** Group flat reactions into UI summary chips (stable allowlist order). */
export function summarizeCommentReactions(
  current: unknown,
  viewerUserId?: string | null
): CommentReactionSummary[] {
  const entries = parseCommentReactions(current);
  const byEmoji = new Map<
    CommentReactionEmoji,
    { userIds: string[]; includesMe: boolean }
  >();

  for (const entry of entries) {
    const bucket = byEmoji.get(entry.emoji) ?? {
      userIds: [],
      includesMe: false,
    };
    bucket.userIds.push(entry.user_id);
    if (viewerUserId && entry.user_id === viewerUserId) {
      bucket.includesMe = true;
    }
    byEmoji.set(entry.emoji, bucket);
  }

  const summaries: CommentReactionSummary[] = [];
  for (const emoji of COMMENT_REACTION_EMOJIS) {
    const bucket = byEmoji.get(emoji);
    if (!bucket || bucket.userIds.length === 0) {
      continue;
    }
    summaries.push({
      emoji,
      count: bucket.userIds.length,
      includesMe: bucket.includesMe,
      userIds: bucket.userIds,
    });
  }
  return summaries;
}
