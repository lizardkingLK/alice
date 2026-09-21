import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { formatZodError, parseWithZod } from '@/lib/zod/format-zod-error';

describe('formatZodError', () => {
  it('returns a single readable validation message', () => {
    const result = z
      .object({ name: z.string().min(1, 'Name is required') })
      .safeParse({ name: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(formatZodError(result.error)).toBe('Name is required');
    }
  });

  it('joins multiple unique validation messages', () => {
    const result = z
      .object({
        name: z.string().min(1, 'This field is required'),
        email: z.string().min(1, 'This field is required'),
        role: z.string().min(1, 'Role is required'),
      })
      .safeParse({ name: '', email: '', role: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(formatZodError(result.error)).toBe(
        'This field is required; Role is required'
      );
    }
  });

  it('does not return serialized JSON', () => {
    const result = z
      .object({ type: z.string().min(1, 'Please select a type') })
      .safeParse({ type: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(formatZodError(result.error)).not.toContain('{"errors"');
      expect(() => JSON.parse(formatZodError(result.error))).toThrow();
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
      parseWithZod(
        z.object({ id: z.string().uuid('ID must be a valid UUID') }),
        { id: 'x' }
      )
    ).toThrow('ID must be a valid UUID');
  });
});
