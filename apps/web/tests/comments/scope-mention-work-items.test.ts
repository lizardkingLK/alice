import { describe, expect, it } from 'vitest';
import { scopeMentionWorkItems } from '@/app/comments/_components/comments-feed-helpers';
import type { CommentWorkItemOption } from '@/app/comments/_services/comments.mutations.shared';

const items: CommentWorkItemOption[] = [
  {
    id: 'wi-1',
    title: 'One',
    key: 'P-1',
    type: 'Task',
    project_id: 'proj-a',
  },
  {
    id: 'wi-2',
    title: 'Two',
    key: 'P-2',
    type: 'Issue',
    project_id: 'proj-a',
  },
  {
    id: 'wi-3',
    title: 'Other',
    key: 'Q-1',
    type: 'Story',
    project_id: 'proj-b',
  },
];

describe('scopeMentionWorkItems', () => {
  it('returns no suggestions until a target work item is selected', () => {
    expect(scopeMentionWorkItems(items, undefined)).toEqual([]);
  });

  it('keeps only work items in the same project as the target', () => {
    expect(scopeMentionWorkItems(items, 'wi-1').map((item) => item.id)).toEqual(
      ['wi-1', 'wi-2']
    );
  });
});
