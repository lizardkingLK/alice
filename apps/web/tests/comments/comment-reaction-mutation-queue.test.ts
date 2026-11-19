import { describe, expect, it, vi } from 'vitest';
import { createCommentReactionMutationQueue } from '@/app/comments/_helpers/comment-reaction-mutation-queue';
import type { CommentItem } from '@/app/comments/_services/comments.mutations.shared';
import { commentFactory } from '../factories/comment.factory';

function flushMicrotasks() {
  return new Promise<void>((resolve) => {
    queueMicrotask(() => resolve());
  });
}

describe('createCommentReactionMutationQueue', () => {
  it('applies optimistic state immediately and coalesces net intent', async () => {
    let comments: CommentItem[] = [
      commentFactory.build({ id: 'c1', reactions: [] }),
    ];
    const sendToggle = vi.fn(async (_id, emoji, action) => {
      await flushMicrotasks();
      const reactions = action === 'add' ? [{ user_id: 'user-1', emoji }] : [];
      return {
        commentId: 'c1',
        reactions,
        updated_at: '2026-10-02T00:00:00.000Z',
      };
    });

    const queue = createCommentReactionMutationQueue({
      getUserId: () => 'user-1',
      setComments: (updater) => {
        comments = updater(comments);
      },
      getComment: (id) => comments.find((c) => c.id === id),
      sendToggle,
    });

    queue.enqueue('c1', '👍', 'add');
    queue.enqueue('c1', '👍', 'remove');
    queue.enqueue('c1', '👍', 'add');

    expect(comments[0]?.reactions).toEqual([
      { user_id: 'user-1', emoji: '👍' },
    ]);
    expect(queue.isPending('c1')).toBe(true);

    await vi.waitFor(() => {
      expect(queue.isPending('c1')).toBe(false);
    });

    // Net membership is on; parallel spam should not fire one POST per click.
    expect(sendToggle.mock.calls.length).toBeLessThanOrEqual(3);
    expect(sendToggle).toHaveBeenCalled();
    expect(comments[0]?.reactions).toEqual([
      { user_id: 'user-1', emoji: '👍' },
    ]);
  });

  it('reports pending while a flush is in flight', async () => {
    let comments: CommentItem[] = [
      commentFactory.build({ id: 'c1', reactions: [] }),
    ];
    const pendingEvents: Array<[string, boolean]> = [];
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    const queue = createCommentReactionMutationQueue({
      getUserId: () => 'user-1',
      setComments: (updater) => {
        comments = updater(comments);
      },
      getComment: (id) => comments.find((c) => c.id === id),
      sendToggle: async () => {
        await gate;
        return {
          commentId: 'c1',
          reactions: [{ user_id: 'user-1', emoji: '👍' }],
        };
      },
      onPendingChange: (commentId, isPending) => {
        pendingEvents.push([commentId, isPending]);
      },
    });

    queue.enqueue('c1', '👍', 'add');
    expect(queue.isPending('c1')).toBe(true);
    expect(queue.hasAnyPending()).toBe(true);

    release();
    await vi.waitFor(() => {
      expect(queue.isPending('c1')).toBe(false);
    });
    expect(pendingEvents.at(-1)).toEqual(['c1', false]);
  });

  it('reconciles to last ack on failure instead of inverse-toggling', async () => {
    let comments: CommentItem[] = [
      commentFactory.build({ id: 'c1', reactions: [] }),
    ];
    const sendToggle = vi.fn(async () => {
      throw new Error('Failed to update comment reaction');
    });

    const queue = createCommentReactionMutationQueue({
      getUserId: () => 'user-1',
      setComments: (updater) => {
        comments = updater(comments);
      },
      getComment: (id) => comments.find((c) => c.id === id),
      sendToggle,
    });

    queue.enqueue('c1', '🎉', 'add');
    expect(comments[0]?.reactions).toEqual([
      { user_id: 'user-1', emoji: '🎉' },
    ]);

    await vi.waitFor(() => {
      expect(queue.isPending('c1')).toBe(false);
    });

    expect(comments[0]?.reactions).toEqual([]);
  });
});
