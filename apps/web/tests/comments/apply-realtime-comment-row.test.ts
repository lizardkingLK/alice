import { describe, expect, it } from 'vitest';
import {
  applyRealtimeCommentChange,
  type CommentRealtimeRow,
} from '@/app/comments/_helpers/apply-realtime-comment-row';
import type { CommentItem } from '@/app/comments/_services/comments.mutations.shared';

const users = [
  {
    id: 'user-1',
    name: 'Ada',
    email: 'ada@example.com',
    profile_picture: null,
  },
];

function row(overrides: Partial<CommentRealtimeRow> = {}): CommentRealtimeRow {
  return {
    id: 'c1',
    work_item_id: 'wi-1',
    author_id: 'user-1',
    parent_id: null,
    content: { type: 'doc', content: [] },
    reactions: [],
    edited: false,
    status: 'active',
    created_at: '2026-10-01T00:00:00.000Z',
    updated_at: '2026-10-01T00:00:00.000Z',
    ...overrides,
  };
}

function item(overrides: Partial<CommentItem> = {}): CommentItem {
  return {
    ...row(),
    author: users[0],
    ...overrides,
  };
}

describe('applyRealtimeCommentChange', () => {
  it('prepends INSERT when id is new', () => {
    const next = applyRealtimeCommentChange([], 'INSERT', row(), users);
    expect(next).toHaveLength(1);
    expect(next?.[0]?.author?.name).toBe('Ada');
  });

  it('ignores INSERT echo when same updated_at already present', () => {
    const existing = [item()];
    expect(
      applyRealtimeCommentChange(existing, 'INSERT', row(), users)
    ).toBeNull();
  });

  it('applies UPDATE when newer updated_at', () => {
    const existing = [item()];
    const next = applyRealtimeCommentChange(
      existing,
      'UPDATE',
      row({
        edited: true,
        updated_at: '2026-10-02T00:00:00.000Z',
      }),
      users
    );
    expect(next?.[0]?.edited).toBe(true);
  });

  it('keeps local reactions while a flush is pending', () => {
    const existing = [
      item({
        reactions: [{ user_id: 'user-1', emoji: '👍' }],
      }),
    ];
    const next = applyRealtimeCommentChange(
      existing,
      'UPDATE',
      row({
        reactions: [],
        edited: true,
        updated_at: '2026-10-02T00:00:00.000Z',
      }),
      users,
      { isReactionFlushPending: () => true }
    );
    expect(next?.[0]?.edited).toBe(true);
    expect(next?.[0]?.reactions).toEqual([{ user_id: 'user-1', emoji: '👍' }]);
  });

  it('removes on DELETE', () => {
    const existing = [item()];
    const next = applyRealtimeCommentChange(
      existing,
      'DELETE',
      { id: 'c1' },
      users
    );
    expect(next).toEqual([]);
  });
});
