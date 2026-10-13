import { describe, expect, it } from 'vitest';
import { isReservedSprintName } from '@repo/types';

describe('isReservedSprintName', () => {
  it('matches backlog case-insensitively', () => {
    expect(isReservedSprintName('Backlog')).toBe(true);
    expect(isReservedSprintName('BACKLOG')).toBe(true);
    expect(isReservedSprintName('  backlog  ')).toBe(true);
  });

  it('allows other names', () => {
    expect(isReservedSprintName('Sprint 1')).toBe(false);
    expect(isReservedSprintName('Backlog planning')).toBe(false);
  });
});
