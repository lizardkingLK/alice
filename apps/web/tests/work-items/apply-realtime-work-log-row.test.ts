import { describe, expect, it } from 'vitest';
import {
  applyRealtimeWorkLogChange,
  type WorkLogRealtimeRow,
} from '@/app/work-items/_helpers/apply-realtime-work-log-row';
import type { WorkItemWorkLog } from '@repo/types';

const users = [
  {
    id: 'user-1',
    name: 'Ada',
    email: 'ada@example.com',
    profile_picture: null,
  },
];

function row(overrides: Partial<WorkLogRealtimeRow> = {}): WorkLogRealtimeRow {
  return {
    id: 'wl-1',
    work_item_id: 'wi-1',
    user_id: 'user-1',
    logged_hours: 1.5,
    logged_at: '2026-10-01T00:00:00.000Z',
    comment: 'Ship it',
    status: 'active',
    ...overrides,
  };
}

describe('applyRealtimeWorkLogChange', () => {
  it('prepends INSERT and enriches user', () => {
    const next = applyRealtimeWorkLogChange([], 'INSERT', row(), users);
    expect(next).toHaveLength(1);
    expect(next?.[0]?.user?.name).toBe('Ada');
  });

  it('ignores INSERT echo when id exists', () => {
    const existing: WorkItemWorkLog[] = [
      {
        id: 'wl-1',
        work_item_id: 'wi-1',
        user_id: 'user-1',
        logged_hours: 1.5,
        logged_at: '2026-10-01T00:00:00.000Z',
        comment: 'Ship it',
        user: users[0],
      },
    ];
    expect(
      applyRealtimeWorkLogChange(existing, 'INSERT', row(), users)
    ).toBeNull();
  });

  it('removes archived UPDATE', () => {
    const existing: WorkItemWorkLog[] = [
      {
        id: 'wl-1',
        work_item_id: 'wi-1',
        user_id: 'user-1',
        logged_hours: 1.5,
        logged_at: '2026-10-01T00:00:00.000Z',
        comment: null,
        user: users[0],
      },
    ];
    expect(
      applyRealtimeWorkLogChange(
        existing,
        'UPDATE',
        row({ status: 'archived' }),
        users
      )
    ).toEqual([]);
  });
});
