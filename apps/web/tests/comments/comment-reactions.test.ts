import { describe, expect, it } from 'vitest';
import {
  mergeCommentReaction,
  parseCommentReactions,
  summarizeCommentReactions,
} from '@repo/types';

describe('comment-reactions', () => {
  it('parses valid entries and drops invalid ones', () => {
    const parsed = parseCommentReactions([
      { user_id: 'u1', emoji: '👍' },
      { user_id: 'u1', emoji: '👍' },
      { user_id: 'u2', emoji: 'not-an-emoji' },
      { emoji: '🎉' },
      null,
    ]);

    expect(parsed).toEqual([{ user_id: 'u1', emoji: '👍' }]);
  });

  it('merges add and remove idempotently', () => {
    const added = mergeCommentReaction([], 'u1', '👍', 'add');
    expect(added).toEqual([{ user_id: 'u1', emoji: '👍' }]);

    const again = mergeCommentReaction(added, 'u1', '👍', 'add');
    expect(again).toEqual([{ user_id: 'u1', emoji: '👍' }]);

    const withOther = mergeCommentReaction(again, 'u2', '🎉', 'add');
    expect(withOther).toHaveLength(2);

    const removed = mergeCommentReaction(withOther, 'u1', '👍', 'remove');
    expect(removed).toEqual([{ user_id: 'u2', emoji: '🎉' }]);

    const removeMissing = mergeCommentReaction(removed, 'u1', '👍', 'remove');
    expect(removeMissing).toEqual([{ user_id: 'u2', emoji: '🎉' }]);
  });

  it('summarizes counts, includesMe, and userIds in allowlist order', () => {
    const summaries = summarizeCommentReactions(
      [
        { user_id: 'u2', emoji: '🎉' },
        { user_id: 'u1', emoji: '👍' },
        { user_id: 'u3', emoji: '👍' },
      ],
      'u1'
    );

    expect(summaries).toEqual([
      {
        emoji: '👍',
        count: 2,
        includesMe: true,
        userIds: ['u1', 'u3'],
      },
      {
        emoji: '🎉',
        count: 1,
        includesMe: false,
        userIds: ['u2'],
      },
    ]);
  });
});
