import { describe, expect, it } from 'vitest';
import {
  flattenWorkItemHierarchyRows,
  workItemCanExpand,
} from '@/app/work-items/_helpers/work-item-hierarchy-rows';
import { workItemFactory } from '../factories/workItem.factory';

describe('workItemCanExpand', () => {
  it('allows expand for Epic, Feature, Story, and Task only', () => {
    expect(workItemCanExpand('Epic')).toBe(true);
    expect(workItemCanExpand('Feature')).toBe(true);
    expect(workItemCanExpand('Story')).toBe(true);
    expect(workItemCanExpand('Task')).toBe(true);
    expect(workItemCanExpand('Issue')).toBe(false);
  });
});

describe('flattenWorkItemHierarchyRows', () => {
  it('returns roots only when nothing is expanded', () => {
    // Arrange
    const epic = workItemFactory.build({
      id: 'epic-1',
      type: 'Epic',
      title: 'Epic root',
      parent_id: null,
    });
    const story = workItemFactory.build({
      id: 'story-1',
      type: 'Story',
      title: 'Orphan story',
      parent_id: null,
    });

    // Act
    const rows = flattenWorkItemHierarchyRows(
      [epic, story],
      new Map(),
      new Set()
    );

    // Assert
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.workItem.id)).toEqual(['epic-1', 'story-1']);
    expect(rows.every((row) => row.depth === 0)).toBe(true);
    expect(rows[0]?.canExpand).toBe(true);
    expect(rows[0]?.isExpanded).toBe(false);
  });

  it('inserts loaded children under an expanded parent', () => {
    // Arrange
    const epic = workItemFactory.build({
      id: 'epic-1',
      type: 'Epic',
      title: 'Epic root',
      parent_id: null,
    });
    const story = workItemFactory.build({
      id: 'story-1',
      type: 'Story',
      title: 'Child story',
      parent_id: 'epic-1',
    });
    const childrenByParentId = new Map([['epic-1', [story]]]);

    // Act
    const rows = flattenWorkItemHierarchyRows(
      [epic],
      childrenByParentId,
      new Set(['epic-1'])
    );

    // Assert
    expect(rows).toHaveLength(2);
    expect(rows[0]?.workItem.id).toBe('epic-1');
    expect(rows[0]?.isExpanded).toBe(true);
    expect(rows[1]?.workItem.id).toBe('story-1');
    expect(rows[1]?.depth).toBe(1);
    expect(rows[1]?.canExpand).toBe(true);
  });

  it('does not expand Issue leaves', () => {
    // Arrange
    const issue = workItemFactory.build({
      id: 'issue-1',
      type: 'Issue',
      parent_id: null,
    });

    // Act
    const rows = flattenWorkItemHierarchyRows(
      [issue],
      new Map(),
      new Set(['issue-1'])
    );

    // Assert
    expect(rows).toHaveLength(1);
    expect(rows[0]?.canExpand).toBe(false);
    expect(rows[0]?.isExpanded).toBe(false);
  });
});
