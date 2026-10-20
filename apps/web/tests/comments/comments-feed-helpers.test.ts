import { describe, expect, it } from 'vitest';
import {
  uniqueCommentsById,
  upsertCommentById,
} from '@/app/comments/_components/comments-feed-helpers';
import type { CommentItem } from '@/app/comments/_services/comments.mutations.shared';

function comment(overrides: Partial<CommentItem> = {}): CommentItem {
  return {
    id: 'c1',
    work_item_id: 'wi-1',
    author_id: 'u1',
    parent_id: null,
    content: { type: 'doc', content: [] },
    edited: false,
    status: 'active',
    created_at: '2026-10-01T00:00:00.000Z',
    updated_at: '2026-10-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('uniqueCommentsById', () => {
  it('keeps the first occurrence of each id', () => {
    const first = comment({ id: 'c1', edited: false });
    const dup = comment({ id: 'c1', edited: true });
    const other = comment({ id: 'c2' });
    expect(uniqueCommentsById([first, dup, other])).toEqual([first, other]);
  });
});

describe('upsertCommentById', () => {
  it('prepends when id is new', () => {
    const existing = comment({ id: 'c0' });
    const created = comment({ id: 'c1' });
    expect(upsertCommentById([existing], created)).toEqual([created, existing]);
  });

  it('replaces when id already exists (realtime race)', () => {
    const fromRealtime = comment({ id: 'c1', edited: false });
    const fromCreate = comment({ id: 'c1', edited: true });
    expect(upsertCommentById([fromRealtime], fromCreate)).toEqual([fromCreate]);
  });
});
