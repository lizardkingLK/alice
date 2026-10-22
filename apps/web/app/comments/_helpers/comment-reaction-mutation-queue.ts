import {
  mergeCommentReaction,
  parseCommentReactions,
  type CommentReactionEmoji,
  type Json,
} from '@repo/types';
import type { CommentItem } from '@/app/comments/_services/comments.mutations.shared';

export type ReactionToggleAction = 'add' | 'remove';

export type CommentReactionFlushResult = {
  readonly commentId: string;
  readonly reactions: Json;
  readonly updated_at?: string;
};

export type CommentReactionSendOptions = {
  readonly keepalive?: boolean;
};

type CommentReactionLane = {
  /** Desired on/off for the current user per emoji. */
  desired: Map<CommentReactionEmoji, boolean>;
  /** Last membership we believe the server has for this user. */
  ack: Map<CommentReactionEmoji, boolean>;
  /** Bumped on every local click; realtime ignores while flushes pending. */
  generation: number;
  pendingFlushes: number;
  chain: Promise<void>;
};

/* eslint-disable no-unused-vars -- documents queue callback contracts */
export type CommentReactionMutationQueueOptions = {
  getUserId: () => string | undefined;
  setComments: (updater: (prev: CommentItem[]) => CommentItem[]) => void;
  getComment: (commentId: string) => CommentItem | undefined;
  sendToggle: (
    commentId: string,
    emoji: CommentReactionEmoji,
    action: ReactionToggleAction,
    options?: CommentReactionSendOptions
  ) => Promise<CommentReactionFlushResult>;
  onPendingChange?: (commentId: string, isPending: boolean) => void;
};
/* eslint-enable no-unused-vars */

function membershipFromReactions(
  reactions: unknown,
  userId: string
): Map<CommentReactionEmoji, boolean> {
  const map = new Map<CommentReactionEmoji, boolean>();
  for (const entry of parseCommentReactions(reactions)) {
    if (entry.user_id === userId) {
      map.set(entry.emoji, true);
    }
  }
  return map;
}

function mapCommentById(
  comments: readonly CommentItem[],
  commentId: string,
  // eslint-disable-next-line no-unused-vars -- documents updater contract
  update: (comment: CommentItem) => CommentItem
): CommentItem[] {
  return comments.map((comment) =>
    comment.id === commentId ? update(comment) : comment
  );
}

function applyOptimisticReactions(
  comments: readonly CommentItem[],
  commentId: string,
  userId: string,
  emoji: CommentReactionEmoji,
  action: ReactionToggleAction
): CommentItem[] {
  return mapCommentById(comments, commentId, (comment) => ({
    ...comment,
    reactions: mergeCommentReaction(
      comment.reactions,
      userId,
      emoji,
      action
    ) as Json,
  }));
}

function replaceCommentReactions(
  comments: readonly CommentItem[],
  commentId: string,
  reactions: Json,
  updatedAt?: string
): CommentItem[] {
  return mapCommentById(comments, commentId, (comment) => ({
    ...comment,
    reactions,
    ...(updatedAt ? { updated_at: updatedAt } : {}),
  }));
}

function reconcileCommentToAck(
  comments: readonly CommentItem[],
  commentId: string,
  userId: string,
  ack: Map<CommentReactionEmoji, boolean>
): CommentItem[] {
  return mapCommentById(comments, commentId, (item) => {
    let reactions = parseCommentReactions(item.reactions).filter(
      (entry) => entry.user_id !== userId
    );
    for (const [ackEmoji, on] of ack) {
      if (on) {
        reactions = mergeCommentReaction(reactions, userId, ackEmoji, 'add');
      }
    }
    return { ...item, reactions: reactions as Json };
  });
}

function collectReactionDiffs(
  desired: Map<CommentReactionEmoji, boolean>,
  ack: Map<CommentReactionEmoji, boolean>
): Array<{ emoji: CommentReactionEmoji; action: ReactionToggleAction }> {
  const diffs: Array<{
    emoji: CommentReactionEmoji;
    action: ReactionToggleAction;
  }> = [];
  for (const [emoji, wantOn] of desired) {
    const ackOn = ack.get(emoji) === true;
    if (wantOn === ackOn) {
      continue;
    }
    diffs.push({ emoji, action: wantOn ? 'add' : 'remove' });
  }
  return diffs;
}

/**
 * Per-comment serial reaction flushes with coalesce.
 * Optimistic UI updates immediately; network work waits for the previous
 * HTTP settle, then sends only net diffs vs last ack — not a message broker.
 * Same pattern as work-item sidebar `mutationQueueRef` / board pending.
 */
export function createCommentReactionMutationQueue(
  options: CommentReactionMutationQueueOptions
) {
  const lanes = new Map<string, CommentReactionLane>();

  function getLane(commentId: string): CommentReactionLane {
    let lane = lanes.get(commentId);
    if (!lane) {
      lane = {
        desired: new Map(),
        ack: new Map(),
        generation: 0,
        pendingFlushes: 0,
        chain: Promise.resolve(),
      };
      lanes.set(commentId, lane);
    }
    return lane;
  }

  function notifyPending(commentId: string, lane: CommentReactionLane) {
    options.onPendingChange?.(commentId, lane.pendingFlushes > 0);
  }

  function isPending(commentId: string): boolean {
    return (lanes.get(commentId)?.pendingFlushes ?? 0) > 0;
  }

  function hasAnyPending(): boolean {
    for (const lane of lanes.values()) {
      if (lane.pendingFlushes > 0) {
        return true;
      }
      if (collectReactionDiffs(lane.desired, lane.ack).length > 0) {
        return true;
      }
    }
    return false;
  }

  function seedAckFromComment(commentId: string, userId: string) {
    const lane = getLane(commentId);
    if (lane.ack.size > 0 || lane.desired.size > 0) {
      return;
    }
    const comment = options.getComment(commentId);
    if (!comment) {
      return;
    }
    lane.ack = membershipFromReactions(comment.reactions, userId);
  }

  async function flushDiffs(
    commentId: string,
    userId: string,
    sendOptions?: CommentReactionSendOptions
  ): Promise<void> {
    const lane = getLane(commentId);
    const diffs = collectReactionDiffs(lane.desired, lane.ack);
    if (diffs.length === 0) {
      return;
    }

    let lastReactions: Json | undefined;
    let lastUpdatedAt: string | undefined;
    const generationAtStart = lane.generation;

    // Serial flushes (coalesce already collapsed net diffs). Recursive send
    // avoids await-in-for (typescript:S9382) while preserving order.
    const sendRemaining = async (remaining: typeof diffs): Promise<void> => {
      const [diff, ...rest] = remaining;
      if (!diff) {
        return;
      }
      const result = await options.sendToggle(
        commentId,
        diff.emoji,
        diff.action,
        sendOptions
      );
      lastReactions = result.reactions;
      lastUpdatedAt = result.updated_at;
      lane.ack = membershipFromReactions(result.reactions, userId);
      await sendRemaining(rest);
    };
    await sendRemaining(diffs);

    const reactionsToApply = lastReactions;
    if (reactionsToApply === undefined) {
      return;
    }

    options.setComments((prev) => {
      if (getLane(commentId).generation !== generationAtStart) {
        return prev;
      }
      return replaceCommentReactions(
        prev,
        commentId,
        reactionsToApply,
        lastUpdatedAt
      );
    });
  }

  function scheduleFlush(
    commentId: string,
    userId: string,
    sendOptions?: CommentReactionSendOptions
  ) {
    const lane = getLane(commentId);
    lane.pendingFlushes += 1;
    notifyPending(commentId, lane);
    lane.chain = lane.chain
      .then(() => flushDiffs(commentId, userId, sendOptions))
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        console.error('error. failed to toggle comment reaction:', message);
        lane.desired = new Map(lane.ack);
        options.setComments((prev) =>
          reconcileCommentToAck(prev, commentId, userId, lane.ack)
        );
      })
      .finally(() => {
        lane.pendingFlushes = Math.max(0, lane.pendingFlushes - 1);
        notifyPending(commentId, lane);
      });
  }

  function enqueue(
    commentId: string,
    emoji: CommentReactionEmoji,
    action: ReactionToggleAction
  ): void {
    const userId = options.getUserId();
    if (!userId) {
      return;
    }

    seedAckFromComment(commentId, userId);
    const lane = getLane(commentId);
    lane.generation += 1;
    lane.desired.set(emoji, action === 'add');

    options.setComments((prev) =>
      applyOptimisticReactions(prev, commentId, userId, emoji, action)
    );

    scheduleFlush(commentId, userId);
  }

  /**
   * Best-effort drain before unload. Uses keepalive so the browser can finish
   * POSTs after the document is gone. Fire-and-forget — do not await in
   * pagehide handlers beyond scheduling.
   */
  function flushPendingKeepalive(): void {
    const userId = options.getUserId();
    if (!userId) {
      return;
    }

    for (const [commentId, lane] of lanes) {
      const diffs = collectReactionDiffs(lane.desired, lane.ack);
      if (diffs.length === 0) {
        continue;
      }
      scheduleFlush(commentId, userId, { keepalive: true });
    }
  }

  async function whenIdle(): Promise<void> {
    const chains = [...lanes.values()].map((lane) => lane.chain);
    await Promise.allSettled(chains);
  }

  return {
    enqueue,
    isPending,
    hasAnyPending,
    flushPendingKeepalive,
    whenIdle,
  };
}

export type CommentReactionMutationQueue = ReturnType<
  typeof createCommentReactionMutationQueue
>;
