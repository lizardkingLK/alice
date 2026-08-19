import {
  API_VERSION,
  API_V2_VERSION,
  type ApiVersionDetails,
  type ApiVersionDetailsV2,
} from '@repo/types';
import type { HealthRepository } from './health.repository';

/** Maps the shared repository record to the v1 wire contract (no `checkedAt`). */
export class HealthService {
  constructor(private readonly healthRepository: HealthRepository) {}

  getVersionDetails(): ApiVersionDetails {
    const { status, runtime, name } = this.healthRepository.getVersionRecord();

    return {
      status,
      runtime,
      name,
      version: API_VERSION,
    };
  }
}

/** Maps the same record to v2 — exposes `checkedAt` and `version: v2`. */
export class HealthServiceV2 {
  constructor(private readonly healthRepository: HealthRepository) {}

  getVersionDetails(): ApiVersionDetailsV2 {
    const record = this.healthRepository.getVersionRecord();

    return {
      status: record.status,
      runtime: record.runtime,
      name: record.name,
      version: API_V2_VERSION,
      checkedAt: record.checkedAt,
    };
  }
}
