import { assignItemsToColumns } from '@/app/board/_helpers/board-columns';
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

describe('boardConfigSchema', () => {
  it('accepts a valid version 1 custom board', () => {
    expect(
      boardConfigSchema.safeParse({ version: '1', columns: CUSTOM_COLUMNS })
        .success
    ).toBe(true);
  });

  it.each([
    { version: '2', columns: CUSTOM_COLUMNS },
    { version: '1', columns: [] },
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
    const columns = [
      { id: 'dev', name: 'Development', status: 'InProgress' },
      { id: 'dev', name: 'Code Review', status: 'InProgress' },
    ];

    expect(boardConfigSchema.safeParse({ version: '1', columns }).success).toBe(
      false
    );
  });
});

describe('assignItemsToColumns', () => {
  it('assigns each item to the first matching column at most once', () => {
    const items = [
      { id: 'new-item', status: 'New' },
      { id: 'progress-item', status: 'InProgress' },
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
      { id: 'draft-item', status: 'Draft' },
      { id: 'done-item', status: 'Done' },
    ] as Parameters<typeof assignItemsToColumns>[0];
    const columns = [
      { id: 'backlog', name: 'Backlog', status: 'New' },
    ] as const;

    const assigned = assignItemsToColumns(items, [...columns]);

    expect(assigned.get('backlog')).toEqual([]);
  });
});
