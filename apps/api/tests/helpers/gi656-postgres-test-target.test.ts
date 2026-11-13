import { describe, expect, it } from 'vitest';
import {
  gi656PostgresTestsEnabled,
  requireGi656PostgresTestUrl,
} from './gi656-postgres-test-target';

describe('GI-656 PostgreSQL live-test safety gate', () => {
  it('is disabled by default and never falls back to application URLs', () => {
    const env = {
      DATABASE_URL: 'postgresql://app:secret@prod.example/alice',
      DIRECT_URL: 'postgresql://app:secret@prod.example/alice',
    } as NodeJS.ProcessEnv;
    expect(gi656PostgresTestsEnabled(env)).toBe(false);
    expect(() => requireGi656PostgresTestUrl(env)).toThrow(
      'RUN_GI656_POSTGRES_TESTS=1 is required.'
    );
  });

  it('rejects missing, mismatched, and non-dev/test targets before returning a URL', () => {
    expect(() =>
      requireGi656PostgresTestUrl({ RUN_GI656_POSTGRES_TESTS: '1' })
    ).toThrow('both required');
    expect(() =>
      requireGi656PostgresTestUrl({
        RUN_GI656_POSTGRES_TESTS: '1',
        GI656_TEST_DATABASE_URL: 'postgresql://localhost/alice_test',
        GI656_TEST_DATABASE_CONFIRM_URL: 'postgresql://localhost/other_test',
      })
    ).toThrow('does not match');
    expect(() =>
      requireGi656PostgresTestUrl({
        RUN_GI656_POSTGRES_TESTS: '1',
        GI656_TEST_DATABASE_URL: 'postgresql://localhost/alice',
        GI656_TEST_DATABASE_CONFIRM_URL: 'postgresql://localhost/alice',
      })
    ).toThrow('explicit dev/test database');
  });

  it('accepts separately confirmed URLs for the same dedicated target', () => {
    expect(
      requireGi656PostgresTestUrl({
        RUN_GI656_POSTGRES_TESTS: '1',
        GI656_TEST_DATABASE_URL:
          'postgresql://runner:first@localhost:5432/alice_test?schema=public',
        GI656_TEST_DATABASE_CONFIRM_URL:
          'postgresql://reviewer:second@LOCALHOST/alice_test',
      })
    ).toContain('runner:first');
  });
});
