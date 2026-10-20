import { describe, expect, it } from 'vitest';
import { replaceEntityInList } from '@/lib/replace-entity-in-list';

describe('replaceEntityInList', () => {
  it('replaces the matching row by id with a shallow merge', () => {
    const items = [
      { id: 'a', name: 'Alpha', note: 'keep' },
      { id: 'b', name: 'Beta', note: 'keep' },
    ];

    const next = replaceEntityInList(items, {
      id: 'b',
      name: 'Beta Updated',
      note: 'keep',
    });

    expect(next).toEqual([
      { id: 'a', name: 'Alpha', note: 'keep' },
      { id: 'b', name: 'Beta Updated', note: 'keep' },
    ]);
    expect(next).not.toBe(items);
  });

  it('preserves fields present only on the current row', () => {
    const items = [{ id: 'a', name: 'Alpha', extra: 1 }];
    const next = replaceEntityInList(items, { id: 'a', name: 'Renamed' } as {
      id: string;
      name: string;
      extra?: number;
    });

    expect(next[0]).toEqual({ id: 'a', name: 'Renamed', extra: 1 });
  });

  it('returns a shallow copy when the id is missing', () => {
    const items = [{ id: 'a', name: 'Alpha' }];
    const next = replaceEntityInList(items, { id: 'missing', name: 'Nope' });

    expect(next).toEqual(items);
    expect(next).not.toBe(items);
  });
});
