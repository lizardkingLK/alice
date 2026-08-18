import { z } from 'zod';

/** URI / contract version for the current public API surface. */
export const API_VERSION = 'v1' as const;

/** Product name returned by the versioned health probe. */
export const API_NAME = 'alice-api' as const;

/** Identity fields shared by health v1 and v2 DTOs. Version folders extend this. */
export const apiHealthIdentitySchema = z.object({
  status: z.literal('ok'),
  runtime: z.literal('express'),
  name: z.literal(API_NAME),
});

/**
 * Version details for `GET /api/v1/health` (and `/api/health`).
 * Static — no database. Additive fields (`name`, `version`) keep `{ status, runtime }` probes working.
 */
export const apiVersionDetailsSchema = apiHealthIdentitySchema.extend({
  version: z.literal(API_VERSION),
});

export type ApiVersionDetails = z.infer<typeof apiVersionDetailsSchema>;

/** Canonical v1 health payload (mock / static). */
export const API_V1_HEALTH = {
  status: 'ok',
  runtime: 'express',
  name: API_NAME,
  version: API_VERSION,
} as const satisfies ApiVersionDetails;
