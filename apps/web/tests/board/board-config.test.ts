import {
  assignItemsToColumns,
  resolveBoardMove,
} from '@/app/board/_helpers/board-columns';
import { boardConfigSchema } from '@repo/types/api/v1';
import { describe, expect, it } from 'vitest';

const CUSTOM_COLUMNS = [
  { id: 'backlog', name: 'Backlog', status: 'New' },
  { id: 'ready', name: 'Ready', status: 'ToDo' },
  { id: 'development', name: 'Development', status: 'InProgress' },
  { id: 'code-review', name: 'Code Review', status: 'InProgress' },
  { id: 'testing', name: 'Testing', status: 'Testing' },
  { id: 'done', name: 'Done', status: 'Done' },
] as const;
const TEAM_ID = '764e1be5-67b4-43dc-a30c-0f66a07ba780';
const USER_ID = '1559d73c-a39f-452d-a275-e981dedff035';

function version2Transition(overrides: Record<string, unknown> = {}) {
  return {
    version: '2',
    columns: CUSTOM_COLUMNS,
    transitions: [
      {
        fromColumnId: 'development',
        toColumnId: 'code-review',
        allowAnyOf: [
          { scope: 'role', role: 'manager' },
          { scope: 'team', teamId: TEAM_ID },
          { scope: 'user', userId: USER_ID },
        ],
        ...overrides,
      },
    ],
  };
}

describe('boardConfigSchema', () => {
  it('accepts a valid version 1 custom board', () => {
    expect(
      boardConfigSchema.safeParse({ version: '1', columns: CUSTOM_COLUMNS })
        .success
    ).toBe(true);
  });

  it('allows multiple columns mapped to the same status', () => {
    expect(
      boardConfigSchema.safeParse({ version: '1', columns: CUSTOM_COLUMNS })
        .success
    ).toBe(true);
  });

  it('accepts a valid version 2 board with transition matchers', () => {
    expect(boardConfigSchema.safeParse(version2Transition()).success).toBe(
      true
    );
  });

  it.each([
    ['missing source', { fromColumnId: 'missing' }],
    ['missing destination', { toColumnId: 'missing' }],
    ['same source and destination', { toColumnId: 'development' }],
    ['empty matcher list', { allowAnyOf: [] }],
    [
      'duplicate matchers',
      {
        allowAnyOf: [
          { scope: 'role', role: 'manager' },
          { scope: 'role', role: 'manager' },
        ],
      },
    ],
    ['invalid role', { allowAnyOf: [{ scope: 'role', role: 'reviewer' }] }],
    ['invalid team id', { allowAnyOf: [{ scope: 'team', teamId: 'team-1' }] }],
    ['invalid user id', { allowAnyOf: [{ scope: 'user', userId: 'user-1' }] }],
  ])('rejects a version 2 transition with %s', (_label, overrides) => {
    expect(
      boardConfigSchema.safeParse(version2Transition(overrides)).success
    ).toBe(false);
  });

  it('rejects duplicate source/destination transition pairs', () => {
    const config = version2Transition();
    config.transitions.push({ ...config.transitions[0]! });
    expect(boardConfigSchema.safeParse(config).success).toBe(false);
  });

  it.each(['New', 'ToDo', 'InProgress', 'Testing', 'Done'] as const)(
    'rejects a board missing %s coverage',
    (missingStatus) => {
      const columns = CUSTOM_COLUMNS.filter(
        (column) => column.status !== missingStatus
      );
      expect(
        boardConfigSchema.safeParse({ version: '1', columns }).success
      ).toBe(false);
    }
  );

  it.each([
    { version: '2', columns: CUSTOM_COLUMNS },
    { version: '1', columns: [] },
    {
      version: '1',
      columns: CUSTOM_COLUMNS.map((column, index) =>
        index === 0 ? { ...column, name: '   ' } : column
      ),
    },
    {
      version: '1',
      columns: [{ id: 'draft', name: 'Draft', status: 'Draft' }],
    },
    {
      version: '1',
      columns: [{ id: 'invalid', name: 'Invalid', status: 'Blocked' }],
    },
  ])('rejects an invalid config', (config) => {
    expect(boardConfigSchema.safeParse(config).success).toBe(false);
  });

  it('rejects duplicate column IDs', () => {
    const columns = CUSTOM_COLUMNS.map((column, index) =>
      index === 1 ? { ...column, id: CUSTOM_COLUMNS[0].id } : column
    );

    expect(boardConfigSchema.safeParse({ version: '1', columns }).success).toBe(
      false
    );
  });
});

describe('assignItemsToColumns', () => {
  it('assigns each item to the first matching column at most once', () => {
    const items = [
      { id: 'new-item', status: 'New', board_column_id: null },
      { id: 'progress-item', status: 'InProgress', board_column_id: null },
    ] as Parameters<typeof assignItemsToColumns>[0];

    const assigned = assignItemsToColumns(items, [...CUSTOM_COLUMNS]);

    expect(assigned.get('backlog')?.map((item) => item.id)).toEqual([
      'new-item',
    ]);
    expect(assigned.get('development')?.map((item) => item.id)).toEqual([
      'progress-item',
    ]);
    expect(assigned.get('code-review')).toEqual([]);
  });

  it('omits Draft items and statuses with no configured column', () => {
    const items = [
      { id: 'draft-item', status: 'Draft', board_column_id: null },
      { id: 'done-item', status: 'Done', board_column_id: null },
    ] as Parameters<typeof assignItemsToColumns>[0];
    const columns = [
      { id: 'backlog', name: 'Backlog', status: 'New' },
    ] as const;

    const assigned = assignItemsToColumns(items, [...columns]);

    expect(assigned.get('backlog')).toEqual([]);
  });

  it('restores an item to its exact persisted same-status column', () => {
    const items = [
      {
        id: 'review-item',
        status: 'InProgress',
        board_column_id: 'code-review',
      },
    ] as Parameters<typeof assignItemsToColumns>[0];

    const assigned = assignItemsToColumns(items, [...CUSTOM_COLUMNS]);

    expect(assigned.get('development')).toEqual([]);
    expect(assigned.get('code-review')?.map((item) => item.id)).toEqual([
      'review-item',
    ]);
  });

  it('falls back by status for legacy and stale column IDs', () => {
    const items = [
      { id: 'legacy-item', status: 'InProgress', board_column_id: null },
      {
        id: 'stale-item',
        status: 'InProgress',
        board_column_id: 'removed-column',
      },
    ] as Parameters<typeof assignItemsToColumns>[0];

    const assigned = assignItemsToColumns(items, [...CUSTOM_COLUMNS]);

    expect(assigned.get('development')?.map((item) => item.id)).toEqual([
      'legacy-item',
      'stale-item',
    ]);
  });
});

describe('resolveBoardMove', () => {
  it('treats movement between duplicate-status custom columns as a change', () => {
    expect(
      resolveBoardMove(
        { status: 'InProgress', board_column_id: 'development' },
        CUSTOM_COLUMNS[3],
        true
      )
    ).toEqual({
      status: 'InProgress',
      board_column_id: 'code-review',
    });
  });

  it('uses status-only placement and clears stale custom placement by default', () => {
    expect(
      resolveBoardMove(
        { status: 'InProgress', board_column_id: 'code-review' },
        { id: 'Done', name: 'Done', status: 'Done' },
        false
      )
    ).toEqual({ status: 'Done', board_column_id: null });
  });
});
