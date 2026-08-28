import type { CommentListRow } from '@repo/types';

export function createCommentListRow(
  overrides: Partial<CommentListRow> = {}
): CommentListRow {
  return {
    id: '44444444-4444-4444-8444-444444444444',
    work_item_id: '55555555-5555-4555-8555-555555555555',
    author_id: '11111111-1111-4111-8111-111111111111',
    parent_id: null,
    content: { type: 'doc', content: [] },
    edited: false,
    status: 'active',
    created_at: new Date('2026-08-01T00:00:00.000Z'),
    updated_at: new Date('2026-08-01T00:00:00.000Z'),
    author: {
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Bob Author',
      email: 'bob@example.com',
      profile_picture: null,
    },
    work_item: {
      id: '55555555-5555-4555-8555-555555555555',
      title: 'Task 1',
      type: 'Task',
      project: {
        id: '33333333-3333-4333-8333-333333333333',
        name: 'Alice',
        key: 'ALICE',
      },
    },
    ...overrides,
  };
}
