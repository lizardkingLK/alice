import { describe, expect, it } from 'vitest';
import { applyRealtimeWorkItemRow } from '@/lib/work-items/apply-realtime-work-item-row';
import { workItemFactory } from '@/tests/factories/workItem.factory';

describe('applyRealtimeWorkItemRow', () => {
  it('skips rows while a flush is pending for that id', () => {
    const current = workItemFactory.build({
      id: 'wi-1',
      status: 'InProgress',
      updated_at: '2026-10-01T00:00:00.000Z',
    });
    const row = {
      id: 'wi-1',
      status: 'Done' as const,
      updated_at: '2026-10-02T00:00:00.000Z',
    };

    const next = applyRealtimeWorkItemRow([current], row, ['status'], {
      isFlushPending: (id) => id === 'wi-1',
    });

    expect(next).toBeNull();
  });

  it('preserves listed fields from local state', () => {
    const current = workItemFactory.build({
      id: 'wi-1',
      status: 'InProgress',
      board_column_id: 'col-local',
      updated_at: '2026-10-01T00:00:00.000Z',
    });
    const row = {
      id: 'wi-1',
      status: 'Done' as const,
      board_column_id: 'col-remote',
      updated_by: 'user-2',
      updated_at: '2026-10-02T00:00:00.000Z',
    };

    const next = applyRealtimeWorkItemRow(
      [current],
      row,
      ['status', 'board_column_id', 'updated_by'],
      { preserveFields: ['status', 'board_column_id'] }
    );

    expect(next?.[0]?.status).toBe('InProgress');
    expect(next?.[0]?.board_column_id).toBe('col-local');
    expect(next?.[0]?.updated_by).toBe('user-2');
    expect(next?.[0]?.updated_at).toBe('2026-10-02T00:00:00.000Z');
  });
});
