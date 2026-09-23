import { describe, expect, it } from 'vitest';
import {
  buildAppliedFilterBadgeItems,
  planAppliedFilterRemovals,
  resolveProjectFilterBadge,
} from '@/components/applied-filter-badges.model';
import { appliedFilterLabelChipId } from '@/components/applied-filter-badges';

describe('buildAppliedFilterBadgeItems', () => {
  it('builds chips for active named filters and labels', () => {
    const items = buildAppliedFilterBadgeItems({
      search: 'login',
      project: { id: 'p1', name: 'Alice' },
      sprint: { id: 's1', name: 'Sprint 1' },
      type: { id: 'Task', name: 'Task' },
      assignee: { id: 'u1', name: 'Ada' },
      priority: { id: 'high', name: 'High' },
      labels: ['Mobile', 'API'],
    });

    expect(items.map((item) => item.id)).toEqual([
      'search',
      'project',
      'sprint',
      'type',
      'assignee',
      'priority',
      appliedFilterLabelChipId('Mobile'),
      appliedFilterLabelChipId('API'),
    ]);
  });

  it('omits empty or null filter values', () => {
    expect(buildAppliedFilterBadgeItems({ search: '  ' })).toEqual([]);
    expect(buildAppliedFilterBadgeItems({})).toEqual([]);
  });
});

describe('resolveProjectFilterBadge', () => {
  it('returns null when the badge should not show', () => {
    expect(
      resolveProjectFilterBadge({
        showBadge: false,
        projectId: 'p1',
        allValue: 'all',
        resolveName: () => 'Alice',
      })
    ).toBeNull();
  });

  it('returns All projects when no concrete project is selected', () => {
    expect(
      resolveProjectFilterBadge({
        showBadge: true,
        projectId: 'all',
        allValue: 'all',
        resolveName: () => 'Alice',
      })
    ).toEqual({ id: 'all', name: 'All projects' });
  });

  it('returns the named project when selected', () => {
    expect(
      resolveProjectFilterBadge({
        showBadge: true,
        projectId: 'p1',
        allValue: 'all',
        resolveName: (id) => (id === 'p1' ? 'Alice' : id),
      })
    ).toEqual({ id: 'p1', name: 'Alice' });
  });
});

describe('planAppliedFilterRemovals', () => {
  it('batches labels and field clears into one plan', () => {
    const plan = planAppliedFilterRemovals([
      appliedFilterLabelChipId('a'),
      appliedFilterLabelChipId('b'),
      'search',
      'sprint',
      'priority',
    ]);

    expect([...plan.labelsToDrop]).toEqual(['a', 'b']);
    expect(plan.clearSearch).toBe(true);
    expect(plan.clearSprint).toBe(true);
    expect(plan.clearPriority).toBe(true);
    expect(plan.clearType).toBe(false);
  });

  it('respects assignee and project clear gates', () => {
    const plan = planAppliedFilterRemovals(['assignee', 'project'], {
      canClearAssignee: false,
      canClearProject: false,
    });
    expect(plan.clearAssignee).toBe(false);
    expect(plan.clearProject).toBe(false);
  });
});
