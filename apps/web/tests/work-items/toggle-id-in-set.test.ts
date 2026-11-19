import { describe, expect, it } from 'vitest';
import { toggleIdInSet } from '@/lib/work-items/toggle-id-in-set';

describe('toggleIdInSet', () => {
  it('returns the same Set reference when membership is unchanged', () => {
    const previous = new Set(['a']);
    expect(toggleIdInSet(previous, 'a', true)).toBe(previous);
    expect(toggleIdInSet(previous, 'b', false)).toBe(previous);
  });

  it('adds and removes ids immutably', () => {
    const previous = new Set(['a']);
    const added = toggleIdInSet(previous, 'b', true);
    expect(added).not.toBe(previous);
    expect([...added].sort()).toEqual(['a', 'b']);

    const removed = toggleIdInSet(added, 'a', false);
    expect([...removed]).toEqual(['b']);
  });
});
