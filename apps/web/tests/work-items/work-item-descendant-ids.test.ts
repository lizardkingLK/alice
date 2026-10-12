import { describe, expect, it } from 'vitest';
import { collectLocalDescendantIds } from '@/app/work-items/_helpers/work-item-descendant-ids';

describe('collectLocalDescendantIds', () => {
  it('collects nested children under a root', () => {
    const items = [
      { id: 'epic', parent_id: null },
      { id: 'story', parent_id: 'epic' },
      { id: 'task', parent_id: 'story' },
      { id: 'other', parent_id: null },
      { id: 'orphan-child', parent_id: 'missing' },
    ];

    expect(collectLocalDescendantIds('epic', items).sort()).toEqual([
      'story',
      'task',
    ]);
    expect(collectLocalDescendantIds('story', items)).toEqual(['task']);
    expect(collectLocalDescendantIds('other', items)).toEqual([]);
  });
});
