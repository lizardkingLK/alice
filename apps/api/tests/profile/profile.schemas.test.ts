import { describe, expect, it } from 'vitest';
import { updateOwnProfileSchema } from '@repo/types';

describe('profile v1 input schemas', () => {
  it('accepts valid name update payloads', () => {
    const parsed = updateOwnProfileSchema.safeParse({
      name: 'Ada Lovelace',
      expectedUpdatedAt: '2026-08-01T00:00:00.000Z',
    });

    expect(parsed.success).toBe(true);
  });

  it('rejects names that are too short', () => {
    const parsed = updateOwnProfileSchema.safeParse({
      name: 'A',
      expectedUpdatedAt: '2026-08-01T00:00:00.000Z',
    });

    expect(parsed.success).toBe(false);
  });

  it('rejects invalid expectedUpdatedAt values', () => {
    const parsed = updateOwnProfileSchema.safeParse({
      name: 'Ada Lovelace',
      expectedUpdatedAt: 'not-a-date',
    });

    expect(parsed.success).toBe(false);
  });
});
