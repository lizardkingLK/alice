import { API_NAME } from '@repo/types';

/** Row-shaped snapshot — stand-in for a Prisma/select read (no real table). */
export type HealthVersionRecord = {
  status: 'ok';
  runtime: 'express';
  name: typeof API_NAME;
  checkedAt: string;
};

export type HealthRepositoryClock = () => Date;

/**
 * Shared data access for health v1 and v2. One repository per domain even when
 * wire versions differ — services map the record to their contract.
 */
export class HealthRepository {
  constructor(private readonly now: HealthRepositoryClock = () => new Date()) {}

  getVersionRecord(): HealthVersionRecord {
    return {
      status: 'ok',
      runtime: 'express',
      name: API_NAME,
      checkedAt: this.now().toISOString(),
    };
  }
}
