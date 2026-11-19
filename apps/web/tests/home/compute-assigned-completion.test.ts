import { describe, expect, it } from 'vitest';
import { computeAssignedCompletionPercent } from '@/app/_components/home/compute-assigned-completion';

describe('computeAssignedCompletionPercent', () => {
  it('returns 0 when there is no assigned work', () => {
    expect(computeAssignedCompletionPercent(0, 0)).toBe(0);
    expect(computeAssignedCompletionPercent(3, 0)).toBe(0);
  });

  it('rounds Done share to a 0–100 percentage', () => {
    expect(computeAssignedCompletionPercent(1, 3)).toBe(33);
    expect(computeAssignedCompletionPercent(1, 2)).toBe(50);
    expect(computeAssignedCompletionPercent(2, 2)).toBe(100);
  });

  it('caps at 100', () => {
    expect(computeAssignedCompletionPercent(5, 4)).toBe(100);
  });
});
