import { describe, expect, it } from 'vitest';
import {
  accessAllowlistCreateSchema,
  accessAllowlistDomainValueSchema,
  accessAllowlistEmailValueSchema,
} from '@repo/types';

describe('accessAllowlistDomainValueSchema', () => {
  it('accepts a hostname with a TLD', () => {
    expect(accessAllowlistDomainValueSchema.parse('fff.com')).toBe('fff.com');
    expect(accessAllowlistDomainValueSchema.parse(' @Acme.COM ')).toBe(
      'acme.com'
    );
  });

  it('rejects a bare label without a TLD', () => {
    const result = accessAllowlistDomainValueSchema.safeParse('fff');
    expect(result.success).toBe(false);
  });
});

describe('accessAllowlistEmailValueSchema', () => {
  it('accepts and lowercases a valid email', () => {
    expect(accessAllowlistEmailValueSchema.parse('  Client@Partner.COM ')).toBe(
      'client@partner.com'
    );
  });

  it('rejects an invalid email', () => {
    expect(accessAllowlistEmailValueSchema.safeParse('fff').success).toBe(
      false
    );
  });
});

describe('accessAllowlistCreateSchema', () => {
  it('accepts a valid domain create payload', () => {
    const parsed = accessAllowlistCreateSchema.parse({
      kind: 'domain',
      value: 'fff.com',
      label: 'Pilot',
    });
    expect(parsed).toMatchObject({
      kind: 'domain',
      value: 'fff.com',
      label: 'Pilot',
    });
  });

  it('rejects domain create when value has no TLD', () => {
    const result = accessAllowlistCreateSchema.safeParse({
      kind: 'domain',
      value: 'fff',
    });
    expect(result.success).toBe(false);
  });
});
