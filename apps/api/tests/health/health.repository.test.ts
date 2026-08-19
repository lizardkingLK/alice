import { describe, expect, it } from 'vitest';
import { API_NAME } from '@repo/types';
import { HealthRepository } from '../../src/routes/api/health/health.repository';

const FIXED_NOW = new Date('2026-08-18T06:00:00.000Z');

describe('HealthRepository', () => {
  it('returns a version record with a stable checkedAt from the injected clock', () => {
    const repository = new HealthRepository(() => FIXED_NOW);

    expect(repository.getVersionRecord()).toEqual({
      status: 'ok',
      runtime: 'express',
      name: API_NAME,
      checkedAt: FIXED_NOW.toISOString(),
    });
  });
});
