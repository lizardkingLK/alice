import { describe, expect, it } from 'vitest';
import {
  buildSearchPanelItems,
  findForestRoots,
  HIERARCHY_FOREST_PAGE_SIZE,
  indexWorkItemsById,
  sliceForestPage,
  walkForestDfs,
} from '@/app/work-items/_helpers/work-item-hierarchy-forest';
import { workItemFactory } from '@/tests/factories/workItem.factory';

describe('walkForestDfs + sliceForestPage', () => {
  it('orders a forest depth-first and prefixes the root on mid-tree pages', () => {
    const epic = workItemFactory.build({
      id: 'epic',
      parent_id: null,
      title: 'Epic',
      type: 'Epic',
      created_at: '2026-01-01T00:00:00Z',
    });
    const children = Array.from({ length: 5 }, (_, index) =>
      workItemFactory.build({
        id: `c${index}`,
        parent_id: 'epic',
        title: `Child ${index}`,
        type: 'Story',
        created_at: `2026-01-0${6 - index}T00:00:00Z`,
      })
    );

    const ordered = walkForestDfs([epic, ...children]);
    expect(ordered.map((entry) => entry.workItem.id)).toEqual([
      'epic',
      'c0',
      'c1',
      'c2',
      'c3',
      'c4',
    ]);

    const page2 = sliceForestPage(ordered, 2, 3);
    expect(page2.items.map((entry) => entry.workItem.id)).toEqual([
      'epic',
      'c2',
      'c3',
      'c4',
    ]);
    expect(page2.pageRoots.map((item) => item.id)).toEqual(['epic']);
    expect(page2.childrenByParentId.epic?.map((item) => item.id)).toEqual([
      'c2',
      'c3',
      'c4',
    ]);
  });

  it('uses the browse hard page size constant of 100', () => {
    expect(HIERARCHY_FOREST_PAGE_SIZE).toBe(100);
  });
});

describe('buildSearchPanelItems', () => {
  it('includes ancestors of matches', () => {
    const epic = workItemFactory.build({
      id: 'epic',
      parent_id: null,
      type: 'Epic',
    });
    const story = workItemFactory.build({
      id: 'story',
      parent_id: 'epic',
      type: 'Story',
    });
    const task = workItemFactory.build({
      id: 'task',
      parent_id: 'story',
      type: 'Task',
      title: 'Board task',
    });
    const byId = indexWorkItemsById([epic, story, task]);
    const { panelItems, matchIds } = buildSearchPanelItems([task], byId);

    expect([...matchIds]).toEqual(['task']);
    expect(panelItems.map((item) => item.id).sort()).toEqual([
      'epic',
      'story',
      'task',
    ]);
    expect(findForestRoots(panelItems, byId).map((item) => item.id)).toEqual([
      'epic',
    ]);
  });
});
