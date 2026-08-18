import { describe, expect, it } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import { AddressInfo } from 'node:net';
import {
  API_NAME,
  API_V1_HEALTH,
  API_V2_VERSION,
  API_VERSION,
  apiV2HealthPayload,
  apiVersionDetailsSchema,
  apiVersionDetailsV2Schema,
} from '@repo/types';
import { HealthRepository } from '../../src/routes/api/health/health.repository';
import {
  HealthService,
  HealthServiceV2,
} from '../../src/routes/api/health/health.service';
import {
  createHealthRouter,
  createHealthV2Router,
} from '../../src/routes/api/health/health.route';

const FIXED_NOW = new Date('2026-08-18T06:00:00.000Z');

function createHealthGraph() {
  const healthRepository = new HealthRepository(() => FIXED_NOW);
  const healthService = new HealthService(healthRepository);
  const healthServiceV2 = new HealthServiceV2(healthRepository);

  return { healthRepository, healthService, healthServiceV2 };
}

async function withHealthApp(
  path: string,
  run: (url: string) => Promise<void>
): Promise<void> {
  const { healthService, healthServiceV2 } = createHealthGraph();
  const app = express();
  app.disable('x-powered-by');
  const v1Router = createHealthRouter({ healthService });
  const v2Router = createHealthV2Router({ healthService: healthServiceV2 });
  app.use('/api/health', v1Router);
  app.use('/api/v1/health', v1Router);
  app.use('/api/v2/health', v2Router);

  const server: Server = await new Promise((resolve) => {
    const next = app.listen(0, '127.0.0.1', () => resolve(next));
  });

  try {
    const address = server.address() as AddressInfo;
    await run(`http://127.0.0.1:${address.port}${path}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

describe('apiVersionDetailsSchema', () => {
  it('accepts the static v1 health payload', () => {
    const parsed = apiVersionDetailsSchema.safeParse(API_V1_HEALTH);

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.version).toBe(API_VERSION);
      expect(parsed.data.name).toBe(API_NAME);
      expect(parsed.data.status).toBe('ok');
      expect(parsed.data.runtime).toBe('express');
    }
  });

  it('rejects a payload without version details', () => {
    const parsed = apiVersionDetailsSchema.safeParse({
      status: 'ok',
      runtime: 'express',
    });

    expect(parsed.success).toBe(false);
  });
});

describe('apiVersionDetailsV2Schema', () => {
  it('accepts v2 with checkedAt', () => {
    const payload = apiV2HealthPayload(FIXED_NOW.toISOString());
    const parsed = apiVersionDetailsV2Schema.safeParse(payload);

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.version).toBe(API_V2_VERSION);
      expect(parsed.data.checkedAt).toBe(FIXED_NOW.toISOString());
    }
  });

  it('rejects v1 shape without checkedAt', () => {
    const parsed = apiVersionDetailsV2Schema.safeParse(API_V1_HEALTH);

    expect(parsed.success).toBe(false);
  });
});

describe('HealthService (v1)', () => {
  it('maps the repository record to v1 wire shape without checkedAt', () => {
    const { healthService } = createHealthGraph();

    expect(healthService.getVersionDetails()).toEqual(API_V1_HEALTH);
  });
});

describe('HealthServiceV2', () => {
  it('maps the same repository record to v2 with checkedAt', () => {
    const { healthServiceV2 } = createHealthGraph();

    expect(healthServiceV2.getVersionDetails()).toEqual(
      apiV2HealthPayload(FIXED_NOW.toISOString())
    );
  });
});

describe('versioned health routes (v1)', () => {
  it.each(['/api/v1/health', '/api/health'])(
    'returns version details at %s',
    async (path) => {
      await withHealthApp(path, async (url) => {
        const response = await fetch(url);
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toEqual(API_V1_HEALTH);
        expect(apiVersionDetailsSchema.safeParse(body).success).toBe(true);
      });
    }
  );
});

describe('versioned health routes (v2)', () => {
  it('returns v2 version details at GET /api/v2/health', async () => {
    await withHealthApp('/api/v2/health', async (url) => {
      const response = await fetch(url);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual(apiV2HealthPayload(FIXED_NOW.toISOString()));
      expect(apiVersionDetailsV2Schema.safeParse(body).success).toBe(true);
    });
  });
});
