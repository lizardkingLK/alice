import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { formatZodError, parseWithZod } from '@/lib/zod/format-zod-error';

describe('formatZodError', () => {
  it('serializes Zod errors as JSON', () => {
    const result = z
      .object({ name: z.string().min(1) })
      .safeParse({ name: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(formatZodError(result.error)).toContain('name');
    }
  });
});

describe('parseWithZod', () => {
  it('returns parsed data on success', () => {
    expect(parseWithZod(z.object({ id: z.string() }), { id: 'abc' })).toEqual({
      id: 'abc',
    });
  });

  it('throws a formatted error on failure', () => {
    expect(() =>
      parseWithZod(z.object({ id: z.string().uuid() }), { id: 'x' })
    ).toThrow(/id/);
  });
});
