import { describe, expect, it } from 'vitest';

import {
  PRISMA_MIGRATIONS_TABLE,
  buildWipePublicAndAuthSql,
  isMissingStorageBucketError,
  isSeedResetRequested,
} from '../src/seed-reset.js';

describe('isSeedResetRequested', () => {
  it('is false by default', () => {
    expect(isSeedResetRequested({}, ['node', 'seed.ts'])).toBe(false);
  });

  it('is true when SEED_RESET=1 or --reset is passed', () => {
    expect(isSeedResetRequested({ SEED_RESET: '1' }, ['node'])).toBe(true);
    expect(isSeedResetRequested({}, ['node', 'seed.ts', '--reset'])).toBe(true);
  });
});

describe('buildWipePublicAndAuthSql', () => {
  it('keeps Prisma history and truncates auth.users', () => {
    const sql = buildWipePublicAndAuthSql();

    expect(sql).toContain(PRISMA_MIGRATIONS_TABLE);
    expect(sql).toContain('TRUNCATE TABLE auth.users CASCADE');
    expect(sql).not.toContain('storage.objects');
  });
});

describe('isMissingStorageBucketError', () => {
  it('matches missing-bucket messages from Storage', () => {
    expect(isMissingStorageBucketError('Bucket not found')).toBe(true);
    expect(isMissingStorageBucketError('The resource does not exist')).toBe(
      true
    );
    expect(isMissingStorageBucketError('Permission denied')).toBe(false);
  });
});
