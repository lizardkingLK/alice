import { describe, expect, it } from 'vitest';
import type { WorkItemActivity } from '@repo/types';
import {
  buildActivityValueLookups,
  describeActivity,
  formatActivityFieldLabel,
  formatActivityFieldValue,
  sortActivitiesNewestFirst,
} from '@/app/work-items/_helpers/work-item-activity-format';

describe('work-item-activity-format', () => {
  it('strips _id from field labels', () => {
    expect(formatActivityFieldLabel('assignee_id')).toBe('assignee');
    expect(formatActivityFieldLabel('sprint_id')).toBe('sprint');
    expect(formatActivityFieldLabel('status')).toBe('status');
    expect(formatActivityFieldLabel(null)).toBe('a field');
  });

  it('resolves member ids to names', () => {
    const memberNamesById = new Map([
      ['3bc4592a-ba7d-471f-9a27-821776b32741', 'Bob Manager'],
    ]);

    expect(
      formatActivityFieldValue(
        'assignee_id',
        '3bc4592a-ba7d-471f-9a27-821776b32741',
        { memberNamesById }
      )
    ).toBe('Bob Manager');
  });

  it('uses Unassigned / Unknown member instead of raw uuids', () => {
    expect(formatActivityFieldValue('assignee_id', null)).toBe('Unassigned');
    expect(
      formatActivityFieldValue(
        'assignee_id',
        '3bc4592a-ba7d-471f-9a27-821776b32741'
      )
    ).toBe('Unknown member');
  });

  it('resolves sprint ids and backlog empty', () => {
    const sprintNamesById = new Map([['sprint-1', 'Sprint 12']]);
    expect(
      formatActivityFieldValue('sprint_id', 'sprint-1', { sprintNamesById })
    ).toBe('Sprint 12');
    expect(formatActivityFieldValue('sprint_id', null)).toBe('Backlog');
  });

  it('builds member and sprint lookup maps with extras', () => {
    const lookups = buildActivityValueLookups({
      projectMembers: [{ id: 'm-1', name: 'Member One' }],
      projectSprints: [{ id: 's-1', name: 'Sprint 1' }],
      assignee: { id: 'a-1', name: 'Assignee' },
      reporter: { id: 'r-1', name: 'Reporter' },
      sprint: { id: 's-2', name: 'Sprint 2' },
    });

    expect(lookups.memberNamesById?.get('m-1')).toBe('Member One');
    expect(lookups.memberNamesById?.get('a-1')).toBe('Assignee');
    expect(lookups.memberNamesById?.get('r-1')).toBe('Reporter');
    expect(lookups.sprintNamesById?.get('s-1')).toBe('Sprint 1');
    expect(lookups.sprintNamesById?.get('s-2')).toBe('Sprint 2');
  });

  it('describes field changes and sorts newest first', () => {
    const older: WorkItemActivity = {
      id: 'act-1',
      work_item_id: 'wi-1',
      actor_id: 'user-1',
      action: 'field_changed',
      field: 'status',
      old_value: 'New',
      new_value: 'Done',
      meta: null,
      created_at: '2026-10-08T09:00:00.000Z',
      actor: {
        id: 'user-1',
        name: 'Alex',
        email: 'alex@example.com',
        profile_picture: null,
      },
    };
    const newer: WorkItemActivity = {
      ...older,
      id: 'act-2',
      created_at: '2026-10-08T11:00:00.000Z',
      action: 'created',
      field: null,
      old_value: null,
      new_value: null,
    };

    expect(describeActivity(older)).toBe(
      'Alex changed status from New to Done'
    );
    expect(sortActivitiesNewestFirst([older, newer]).map((a) => a.id)).toEqual([
      'act-2',
      'act-1',
    ]);
  });
});
