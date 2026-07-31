import { describe, it, expect } from 'vitest';
import { averageStatusCompletionPercent } from '@/app/work-items/_helpers/work-item-status';

describe('averageStatusCompletionPercent', () => {
  it('returns 0 for an empty list', () => {
    expect(averageStatusCompletionPercent([])).toBe(0);
  });

  it('returns 0 when all items are not started', () => {
    expect(averageStatusCompletionPercent(['New', 'ToDo', 'Draft'])).toBe(0);
  });

  it('averages Done + InProgress + not started to 42%', () => {
    // (100 + 25 + 0) / 3 → 41.67 → 42
    expect(averageStatusCompletionPercent(['Done', 'InProgress', 'ToDo'])).toBe(
      42
    );
  });

  it('returns 100 when every child is Done', () => {
    expect(averageStatusCompletionPercent(['Done', 'Done'])).toBe(100);
  });
});
