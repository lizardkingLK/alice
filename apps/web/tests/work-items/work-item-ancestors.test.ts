import { describe, expect, it } from 'vitest';
import {
  flattenWorkItemAncestorEmbed,
  type WorkItemAncestorEmbedRow,
} from '@/app/work-items/_helpers/work-item-ancestors';

describe('flattenWorkItemAncestorEmbed', () => {
  it('returns empty for null/undefined', () => {
    expect(flattenWorkItemAncestorEmbed(null)).toEqual([]);
    expect(flattenWorkItemAncestorEmbed(undefined)).toEqual([]);
  });

  it('returns a single ancestor root-first', () => {
    const row: WorkItemAncestorEmbedRow = {
      id: 'epic-1',
      type: 'Epic',
      title: 'Epic',
      parent_id: null,
    };
    expect(flattenWorkItemAncestorEmbed(row)).toEqual([
      { id: 'epic-1', type: 'Epic', title: 'Epic', parent_id: null },
    ]);
  });

  it('flattens a nested chain root-first', () => {
    const row: WorkItemAncestorEmbedRow = {
      id: 'task-1',
      type: 'Task',
      title: 'Task',
      parent_id: 'story-1',
      parent: {
        id: 'story-1',
        type: 'Story',
        title: 'Story',
        parent_id: 'epic-1',
        parent: {
          id: 'epic-1',
          type: 'Epic',
          title: 'Epic',
          parent_id: null,
        },
      },
    };

    expect(flattenWorkItemAncestorEmbed(row)).toEqual([
      { id: 'epic-1', type: 'Epic', title: 'Epic', parent_id: null },
      { id: 'story-1', type: 'Story', title: 'Story', parent_id: 'epic-1' },
      { id: 'task-1', type: 'Task', title: 'Task', parent_id: 'story-1' },
    ]);
  });

  it('stops at max depth', () => {
    const row: WorkItemAncestorEmbedRow = {
      id: 'a',
      type: 'Issue',
      title: 'A',
      parent_id: 'b',
      parent: {
        id: 'b',
        type: 'Task',
        title: 'B',
        parent_id: 'c',
        parent: {
          id: 'c',
          type: 'Story',
          title: 'C',
          parent_id: 'd',
          parent: {
            id: 'd',
            type: 'Epic',
            title: 'D',
            parent_id: null,
          },
        },
      },
    };

    expect(flattenWorkItemAncestorEmbed(row, 2)).toEqual([
      { id: 'b', type: 'Task', title: 'B', parent_id: 'c' },
      { id: 'a', type: 'Issue', title: 'A', parent_id: 'b' },
    ]);
  });

  it('stops when a parent cycle repeats an id', () => {
    const row: WorkItemAncestorEmbedRow = {
      id: 'task-1',
      type: 'Task',
      title: 'Task',
      parent_id: 'story-1',
      parent: {
        id: 'story-1',
        type: 'Story',
        title: 'Story',
        parent_id: 'task-1',
        parent: {
          id: 'task-1',
          type: 'Task',
          title: 'Task again',
          parent_id: 'story-1',
        },
      },
    };

    expect(flattenWorkItemAncestorEmbed(row)).toEqual([
      { id: 'story-1', type: 'Story', title: 'Story', parent_id: 'task-1' },
      { id: 'task-1', type: 'Task', title: 'Task', parent_id: 'story-1' },
    ]);
  });

  it('ignores array-shaped parent embeds (wrong FK direction)', () => {
    const row = {
      id: 'story-1',
      type: 'Story' as const,
      title: 'Story',
      parent_id: 'epic-1',
      // PostgREST child embed mistaken for parent
      parent: [
        {
          id: 'task-1',
          type: 'Task' as const,
          title: 'Child task',
          parent_id: 'story-1',
        },
      ],
    } as unknown as WorkItemAncestorEmbedRow;

    expect(flattenWorkItemAncestorEmbed(row)).toEqual([
      { id: 'story-1', type: 'Story', title: 'Story', parent_id: 'epic-1' },
    ]);
  });
});
