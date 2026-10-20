import { describe, expect, it } from 'vitest';
import {
  childrenByParentIdToMap,
  collectSubtreeItems,
  groupWorkItemsByParentId,
  seedForestChildrenByParentId,
} from '@/app/work-items/_helpers/work-item-hierarchy-children';
import { indexWorkItemsById } from '@/app/work-items/_helpers/work-item-hierarchy-forest';
import { workItemFactory } from '@/tests/factories/workItem.factory';

describe('groupWorkItemsByParentId', () => {
  it('groups children under their parent_id', () => {
    const a = workItemFactory.build({
      id: 's1',
      parent_id: 'epic-1',
      title: 'Story 1',
    });
    const b = workItemFactory.build({
      id: 's2',
      parent_id: 'epic-1',
      title: 'Story 2',
    });
    const c = workItemFactory.build({
      id: 't1',
      parent_id: 'epic-2',
      title: 'Task',
    });

    expect(groupWorkItemsByParentId([a, b, c])).toEqual({
      'epic-1': [a, b],
      'epic-2': [c],
    });
  });

  it('skips rows without parent_id', () => {
    const root = workItemFactory.build({ id: 'root', parent_id: null });
    expect(groupWorkItemsByParentId([root])).toEqual({});
  });
});

describe('childrenByParentIdToMap', () => {
  it('copies into a Map', () => {
    const child = workItemFactory.build({ id: 'c1', parent_id: 'p1' });
    const map = childrenByParentIdToMap({ p1: [child] });
    expect(map.get('p1')).toEqual([child]);
  });
});

describe('seedForestChildrenByParentId', () => {
  it('groups children and seeds empty lists for leaves', () => {
    const epic = workItemFactory.build({ id: 'epic', parent_id: null });
    const story = workItemFactory.build({ id: 'story', parent_id: 'epic' });
    const seeded = seedForestChildrenByParentId([epic, story]);
    expect(seeded.epic).toEqual([story]);
    expect(seeded.story).toEqual([]);
  });
});

describe('collectSubtreeItems', () => {
  it('returns the root and all descendants', () => {
    const epic = workItemFactory.build({ id: 'epic', parent_id: null });
    const story = workItemFactory.build({ id: 'story', parent_id: 'epic' });
    const task = workItemFactory.build({ id: 'task', parent_id: 'story' });
    const other = workItemFactory.build({ id: 'other', parent_id: null });
    const items = [epic, story, task, other];
    const byId = indexWorkItemsById(items);
    const byParent = groupWorkItemsByParentId(items);
    expect(
      collectSubtreeItems('epic', byId, byParent).map((i) => i.id)
    ).toEqual(['epic', 'story', 'task']);
  });
});
