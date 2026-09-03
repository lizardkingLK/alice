import { describe, expect, it } from 'vitest';
import { prismaLockTimestampRange } from '../../src/lib/prisma-audit';

describe('prismaLockTimestampRange', () => {
  it('covers the full millisecond bucket for a microsecond timestamptz string', () => {
    const range = prismaLockTimestampRange('2026-08-31T06:00:00.123456+00:00');
    const ms = new Date('2026-08-31T06:00:00.123456+00:00').getTime();

    expect(range.gte).toEqual(new Date(ms));
    expect(range.lt).toEqual(new Date(ms + 1));
  });

  it('throws for invalid timestamps', () => {
    expect(() => prismaLockTimestampRange('not-a-date')).toThrow(TypeError);
    expect(() => prismaLockTimestampRange('not-a-date')).toThrow(
      'Invalid expectedUpdatedAt'
    );
  });
});
