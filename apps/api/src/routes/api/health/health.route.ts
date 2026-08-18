import { Router } from 'express';
import type { HealthService, HealthServiceV2 } from './health.service';

export type HealthRouterDeps = {
  healthService: Pick<HealthService, 'getVersionDetails'>;
};

export type HealthV2RouterDeps = {
  healthService: Pick<HealthServiceV2, 'getVersionDetails'>;
};

function createHealthJsonRouter(getVersionDetails: () => unknown): Router {
  const healthRouter: Router = Router();

  healthRouter.get('/', (_req, res) => {
    res.json(getVersionDetails());
  });

  return healthRouter;
}

/**
 * v1 health probe. Mount at `/api/health` and `/api/v1/health` (aliases).
 * `GET /` is the root status line (`createRootRouter`), not this payload.
 */
export function createHealthRouter(deps: HealthRouterDeps): Router {
  return createHealthJsonRouter(() => deps.healthService.getVersionDetails());
}

/** v2 health probe — mount at `/api/v2/health` only (no unversioned alias). */
export function createHealthV2Router(deps: HealthV2RouterDeps): Router {
  return createHealthJsonRouter(() => deps.healthService.getVersionDetails());
}
