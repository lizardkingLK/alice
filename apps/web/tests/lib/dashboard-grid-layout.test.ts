import { describe, expect, it } from 'vitest';
import type { LayoutItem } from 'react-grid-layout';
import { mergeStoredDashboardLayout } from '@/lib/dashboard-grid-layout';

const defaults: LayoutItem[] = [
  { i: 'a', x: 0, y: 0, w: 3, h: 3, minW: 2, minH: 3 },
  { i: 'b', x: 3, y: 0, w: 3, h: 3, minW: 2, minH: 3 },
];

describe('mergeStoredDashboardLayout', () => {
  it('clones defaults when stored is empty', () => {
    const next = mergeStoredDashboardLayout(defaults, null);
    expect(next).toEqual(defaults);
    expect(next).not.toBe(defaults);
    expect(next[0]).not.toBe(defaults[0]);
  });

  it('restores x/y/w/h for known ids and keeps default mins', () => {
    const next = mergeStoredDashboardLayout(defaults, [
      { i: 'a', x: 1, y: 2, w: 4, h: 5 },
      { i: 'unknown', x: 0, y: 0, w: 1, h: 1 },
    ]);
    expect(next[0]).toMatchObject({
      i: 'a',
      x: 1,
      y: 2,
      w: 4,
      h: 5,
      minW: 2,
      minH: 3,
    });
    expect(next[1]).toEqual(defaults[1]);
  });

  it('ignores invalid stored entries', () => {
    const next = mergeStoredDashboardLayout(defaults, [
      { i: 'a' },
      'nope',
      null,
    ]);
    expect(next).toEqual(defaults);
  });
});
