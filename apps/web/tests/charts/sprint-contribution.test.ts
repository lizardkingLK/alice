import { describe, expect, it } from 'vitest';
import {
  buildSprintContributionGroups,
  clampContributionAsOf,
  computeBurndownIdealSpent,
  groupsFromSprintContributionRollupRows,
  sprintContributionLoggedBand,
  sprintContributionPercent,
} from '@repo/types';

describe('sprint contribution helpers', () => {
  it('clamps as-of into the sprint window', () => {
    expect(
      clampContributionAsOf('2026-01-01', '2026-01-10', '2026-01-20')
    ).toBe('2026-01-10');
    expect(
      clampContributionAsOf('2026-02-01', '2026-01-10', '2026-01-20')
    ).toBe('2026-01-20');
    expect(
      clampContributionAsOf('2026-01-15', '2026-01-10', '2026-01-20')
    ).toBe('2026-01-15');
  });

  it('maps logged completion to color bands', () => {
    expect(sprintContributionLoggedBand(0, 10)).toBe('critical');
    expect(sprintContributionLoggedBand(2.5, 10)).toBe('critical');
    expect(sprintContributionLoggedBand(4, 10)).toBe('low');
    expect(sprintContributionLoggedBand(6, 10)).toBe('mid');
    expect(sprintContributionLoggedBand(9, 10)).toBe('high');
  });

  it('builds active, unassigned, and done groups with behind flag', () => {
    const groups = buildSprintContributionGroups({
      items: [
        {
          id: 'wi-1',
          assigneeId: 'user-a',
          storyPoints: 10,
          isDone: false,
        },
        {
          id: 'wi-2',
          assigneeId: 'user-b',
          storyPoints: 8,
          isDone: true,
        },
        {
          id: 'wi-3',
          assigneeId: null,
          storyPoints: 5,
          isDone: false,
        },
      ],
      logs: [
        {
          workItemId: 'wi-1',
          loggedAt: '2026-01-12T12:00:00.000Z',
          loggedHours: 1,
        },
        {
          workItemId: 'wi-2',
          loggedAt: '2026-01-12T12:00:00.000Z',
          loggedHours: 8,
        },
      ],
      startDate: '2026-01-10',
      endDate: '2026-01-20',
      asOf: '2026-01-15',
      assigneeNames: {
        'user-a': 'Ada',
        'user-b': 'Bob',
      },
    });

    const active = groups.find((group) => group.id === 'active');
    const unassigned = groups.find((group) => group.id === 'unassigned');
    const done = groups.find((group) => group.id === 'done');

    expect(active?.rows).toHaveLength(1);
    expect(active?.rows[0]?.assigneeName).toBe('Ada');
    expect(active?.rows[0]?.behind).toBe(true);
    expect(active?.rows[0]?.idealSpent).toBe(
      computeBurndownIdealSpent(10, '2026-01-10', '2026-01-20', '2026-01-15')
    );

    expect(done?.rows).toHaveLength(1);
    expect(done?.rows[0]?.assigneeName).toBe('Bob');
    expect(done?.rows[0]?.behind).toBe(false);

    expect(unassigned?.rows).toHaveLength(1);
    expect(unassigned?.rows[0]?.assigneeId).toBeNull();
    expect(unassigned?.rows[0]?.behind).toBe(false);
    expect(unassigned?.rows[0]?.estimatedPoints).toBe(5);
  });

  it('filters to a single assignee and omits unassigned', () => {
    const groups = buildSprintContributionGroups({
      items: [
        {
          id: 'wi-1',
          assigneeId: 'user-a',
          storyPoints: 4,
          isDone: false,
        },
        {
          id: 'wi-2',
          assigneeId: null,
          storyPoints: 3,
          isDone: false,
        },
      ],
      logs: [],
      startDate: '2026-01-10',
      endDate: '2026-01-20',
      asOf: '2026-01-12',
      assigneeId: 'user-a',
      assigneeNames: { 'user-a': 'Ada' },
    });

    expect(groups.find((group) => group.id === 'active')?.rows).toHaveLength(1);
    expect(
      groups.find((group) => group.id === 'unassigned')?.rows
    ).toHaveLength(0);
  });

  it('computes progress percent capped at 100', () => {
    expect(sprintContributionPercent(5, 10)).toBe(50);
    expect(sprintContributionPercent(12, 10)).toBe(100);
    expect(sprintContributionPercent(1, 0)).toBe(0);
  });

  it('maps rollup rows into groups with ideal derived at read', () => {
    const groups = groupsFromSprintContributionRollupRows({
      rows: [
        {
          assigneeId: 'user-a',
          group: 'active',
          estimatedPoints: 10,
          loggedHours: 1,
          itemCount: 1,
          asOf: '2026-01-15',
        },
      ],
      startDate: '2026-01-10',
      endDate: '2026-01-20',
      asOf: '2026-01-15',
      assigneeNames: { 'user-a': 'Ada' },
    });

    expect(groups.find((group) => group.id === 'active')?.rows).toEqual([
      expect.objectContaining({
        assigneeName: 'Ada',
        behind: true,
        idealSpent: computeBurndownIdealSpent(
          10,
          '2026-01-10',
          '2026-01-20',
          '2026-01-15'
        ),
      }),
    ]);
  });
});
