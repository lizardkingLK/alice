import { z } from 'zod';
import { API_NAME, apiHealthIdentitySchema } from '../v1/health.js';

/** URI / contract version for the v2 health probe. */
export const API_V2_VERSION = 'v2' as const;

/**
 * Version details for `GET /api/v2/health`.
 * v2 DTO = shared identity + `version: v2` + required `checkedAt`.
 */
export const apiVersionDetailsV2Schema = apiHealthIdentitySchema.extend({
  version: z.literal(API_V2_VERSION),
  checkedAt: z.iso.datetime(),
});

export type ApiVersionDetailsV2 = z.infer<typeof apiVersionDetailsV2Schema>;

/** Shape helper for tests — `checkedAt` is supplied at runtime. */
export const apiV2HealthPayload = (checkedAt: string): ApiVersionDetailsV2 => ({
  status: 'ok',
  runtime: 'express',
  name: API_NAME,
  version: API_V2_VERSION,
  checkedAt,
});
