import { describe, expect, it } from 'vitest';
import {
  clearPendingAttempt,
  createBoardMoveAttemptId,
  isNewerUpdatedAt,
  mergeBoardPlacementRow,
  upsertPendingAttempt,
  type BoardMovePendingAttempt,
} from '@/app/board/_helpers/board-move-pending';
import { applyRealtimeBoardRow } from '@/app/board/_hooks/use-board-work-items-realtime';
import type { DbWorkItem } from '@/app/work-items/_services/work-items.reads.server';

const attempt = (
  overrides: Partial<BoardMovePendingAttempt> = {}
): BoardMovePendingAttempt => ({
  attemptId: 'a1',
  workItemId: 'wi-1',
  previousStatus: 'New',
  previousBoardColumnId: 'new',
  previousUpdatedAt: '2026-10-01T00:00:00.000Z',
  targetStatus: 'ToDo',
  targetBoardColumnId: 'todo',
  ...overrides,
});

const item = {
  id: 'wi-1',
  status: 'New',
  board_column_id: 'new',
  updated_at: '2026-10-01T00:00:00.000Z',
  updated_by: null,
  assignee: null,
  reporter: null,
} as unknown as DbWorkItem;

describe('board-move-pending', () => {
  it('creates attempt ids', () => {
    expect(createBoardMoveAttemptId().length).toBeGreaterThan(8);
  });

  it('upserts and clears by attempt id', () => {
    let map = upsertPendingAttempt(new Map(), attempt());
    expect(map.get('wi-1')?.attemptId).toBe('a1');
    map = clearPendingAttempt(map, 'wi-1', 'other');
    expect(map.has('wi-1')).toBe(true);
    map = clearPendingAttempt(map, 'wi-1', 'a1');
    expect(map.has('wi-1')).toBe(false);
  });

  it('compares updated_at and merges placement', () => {
    expect(
      isNewerUpdatedAt('2026-10-02T00:00:00.000Z', '2026-10-01T00:00:00.000Z')
    ).toBe(true);
    expect(
      isNewerUpdatedAt('2026-10-01T00:00:00.000Z', '2026-10-02T00:00:00.000Z')
    ).toBe(false);

    const merged = mergeBoardPlacementRow(item, {
      status: 'Done',
      board_column_id: 'done',
      updated_at: '2026-10-03T00:00:00.000Z',
    });
    expect(merged.status).toBe('Done');
    expect(merged.board_column_id).toBe('done');
    expect(merged.updated_at).toBe('2026-10-03T00:00:00.000Z');
  });

  it('applies realtime rows only when newer', () => {
    expect(
      applyRealtimeBoardRow([item], {
        id: 'wi-1',
        status: 'ToDo',
        updated_at: '2026-09-01T00:00:00.000Z',
      })
    ).toBeNull();

    const next = applyRealtimeBoardRow([item], {
      id: 'wi-1',
      status: 'ToDo',
      board_column_id: 'todo',
      updated_at: '2026-10-02T00:00:00.000Z',
    });
    expect(next?.[0]?.status).toBe('ToDo');
    expect(next?.[0]?.board_column_id).toBe('todo');
  });
});
