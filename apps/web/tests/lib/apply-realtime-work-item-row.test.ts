import { describe, expect, it } from 'vitest';
import {
  applyRealtimeWorkItemRow,
  mergeWorkItemRealtimeRow,
} from '@/lib/work-items/apply-realtime-work-item-row';
import { workItemFactory } from '@/tests/factories/workItem.factory';

describe('mergeWorkItemRealtimeRow', () => {
  it('merges listed fields and keeps embeds', () => {
    const current = workItemFactory.build({
      id: 'wi-1',
      due_date: '2099-01-01',
      sprint_id: 'sprint-a',
      updated_at: '2026-10-01T00:00:00.000Z',
      assignee: { id: 'u1', name: 'Ada', email: 'ada@example.com' },
    });

    const merged = mergeWorkItemRealtimeRow(
      current,
      {
        id: 'wi-1',
        due_date: '2099-02-01',
        sprint_id: 'sprint-b',
        updated_at: '2026-10-02T00:00:00.000Z',
      },
      ['due_date', 'sprint_id']
    );

    expect(merged.due_date).toBe('2099-02-01');
    expect(merged.sprint_id).toBe('sprint-b');
    expect(merged.updated_at).toBe('2026-10-02T00:00:00.000Z');
    expect(merged.assignee).toEqual(current.assignee);
  });
});

describe('applyRealtimeWorkItemRow', () => {
  it('returns null when the row is not newer', () => {
    const current = workItemFactory.build({
      id: 'wi-1',
      due_date: '2099-01-01',
      updated_at: '2026-10-02T00:00:00.000Z',
    });
    const next = applyRealtimeWorkItemRow(
      [current],
      {
        id: 'wi-1',
        due_date: '2099-03-01',
        updated_at: '2026-10-01T00:00:00.000Z',
      },
      ['due_date']
    );
    expect(next).toBeNull();
  });

  it('replaces the row when updated_at is newer', () => {
    const current = workItemFactory.build({
      id: 'wi-1',
      due_date: '2099-01-01',
      updated_at: '2026-10-01T00:00:00.000Z',
    });
    const next = applyRealtimeWorkItemRow(
      [current],
      {
        id: 'wi-1',
        due_date: '2099-03-01',
        updated_at: '2026-10-02T00:00:00.000Z',
      },
      ['due_date']
    );
    expect(next?.[0]?.due_date).toBe('2099-03-01');
  });
});
