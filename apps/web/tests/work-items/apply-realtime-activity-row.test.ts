import { describe, expect, it } from 'vitest';
import {
  applyRealtimeActivityChange,
  type ActivityRealtimeRow,
} from '@/app/work-items/_helpers/apply-realtime-activity-row';
import type { WorkItemActivity } from '@repo/types';

const actors = [
  {
    id: 'user-1',
    name: 'Ada',
    email: 'ada@example.com',
    profile_picture: null,
  },
];

function row(
  overrides: Partial<ActivityRealtimeRow> = {}
): ActivityRealtimeRow {
  return {
    id: 'a1',
    work_item_id: 'wi-1',
    actor_id: 'user-1',
    action: 'field_changed',
    field: 'title',
    old_value: 'Old',
    new_value: 'New',
    meta: null,
    created_at: '2026-10-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('applyRealtimeActivityChange', () => {
  it('prepends INSERT and enriches actor', () => {
    const next = applyRealtimeActivityChange([], 'INSERT', row(), actors);
    expect(next).toHaveLength(1);
    expect(next?.[0]?.actor?.name).toBe('Ada');
  });

  it('skips duplicate id', () => {
    const existing: WorkItemActivity[] = [
      {
        ...row(),
        actor: actors[0]!,
      },
    ];
    expect(
      applyRealtimeActivityChange(existing, 'INSERT', row(), actors)
    ).toBeNull();
  });

  it('removes on DELETE', () => {
    const existing: WorkItemActivity[] = [{ ...row(), actor: actors[0]! }];
    expect(
      applyRealtimeActivityChange(existing, 'DELETE', { id: 'a1' }, actors)
    ).toEqual([]);
  });
});
