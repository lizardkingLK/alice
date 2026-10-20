import { beforeEach, describe, expect, it, vi } from 'vitest';

const ACTOR_ID = '22222222-2222-4222-8222-222222222222';

vi.mock('../../src/middlewares/auth', () => ({
  requireApiAuth: (
    req: { headers: { authorization?: string }; userId?: string },
    res: { status: (status: number) => { json: (body: unknown) => void } },
    next: () => void
  ) => {
    if (req.headers.authorization !== 'Bearer valid-token') {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    req.userId = ACTOR_ID;
    next();
  },
}));

import {
  ReportAccessError,
  type ReportsService,
} from '../../src/routes/api/reports/reports.service';
import { createReportsRouter } from '../../src/routes/api/reports/reports.route';
import { ReportTimezoneError } from '../../src/routes/api/reports/reports.timezone';
import { withMountedRouter } from '../helpers/route-test.harness';

const generateMock = vi.fn();
const reportsService = { generate: generateMock } as unknown as ReportsService;
const reportsRouter = createReportsRouter({ reportsService });

async function post(baseUrl: string, body: unknown, token = 'valid-token') {
  return fetch(`${baseUrl}/api/v1/reports/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

describe('POST /api/v1/reports/generate', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects unauthenticated requests', async () => {
    await withMountedRouter(
      '/api/v1/reports',
      reportsRouter,
      async (baseUrl) => {
        const response = await post(baseUrl, {}, '');

        expect(response.status).toBe(401);
        await expect(response.json()).resolves.toEqual({
          error: 'Unauthorized',
        });
        expect(generateMock).not.toHaveBeenCalled();
      }
    );
  });

  it('rejects invalid requests before calling the service', async () => {
    await withMountedRouter(
      '/api/v1/reports',
      reportsRouter,
      async (baseUrl) => {
        const response = await post(baseUrl, {
          reportType: 'daily',
          reportDate: 'not-a-date',
          timezone: 'UTC',
        });

        expect(response.status).toBe(400);
        expect(await response.json()).toHaveProperty('error');
        expect(generateMock).not.toHaveBeenCalled();
      }
    );
  });

  it('returns a generated daily report', async () => {
    const generated = {
      snapshot: { summary: {} },
      markdown: '# Daily',
      metadata: {},
    };
    generateMock.mockResolvedValue(generated);

    await withMountedRouter(
      '/api/v1/reports',
      reportsRouter,
      async (baseUrl) => {
        const request = {
          reportType: 'daily',
          reportDate: '2026-10-20',
          timezone: 'UTC',
          verbosity: 'detailed',
        };
        const response = await post(baseUrl, request);

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({ data: generated });
        expect(generateMock).toHaveBeenCalledWith(ACTOR_ID, request);
      }
    );
  });

  it('returns 403 when a requested project is inaccessible', async () => {
    generateMock.mockRejectedValue(new ReportAccessError());

    await withMountedRouter(
      '/api/v1/reports',
      reportsRouter,
      async (baseUrl) => {
        const response = await post(baseUrl, {
          reportType: 'daily',
          reportDate: '2026-10-20',
          timezone: 'UTC',
        });

        expect(response.status).toBe(403);
        await expect(response.json()).resolves.toEqual({
          error: 'Forbidden',
        });
      }
    );
  });

  it('returns 400 when the date did not exist in the requested timezone', async () => {
    generateMock.mockRejectedValue(
      new ReportTimezoneError(
        '2011-12-30 does not exist in timezone Pacific/Apia'
      )
    );

    await withMountedRouter(
      '/api/v1/reports',
      reportsRouter,
      async (baseUrl) => {
        const response = await post(baseUrl, {
          reportType: 'daily',
          reportDate: '2011-12-30',
          timezone: 'Pacific/Apia',
        });

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toEqual({
          error: '2011-12-30 does not exist in timezone Pacific/Apia',
        });
      }
    );
  });
});
