import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  process.env.GITHUB_ACTIONS = 'true';
});

vi.mock('../../src/middlewares/auth', () => {
  return {
    requireApiAuth: (
      req: { headers: { authorization?: string }; userId?: string },
      res: { status: (status: number) => { json: (body: unknown) => void } },
      next: () => void
    ) => {
      if (req.headers.authorization !== 'Bearer valid-token') {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      req.userId = 'user-1';
      next();
    },
  };
});

import { createSprintsRouter } from '../../src/routes/api/sprints/sprints.route';
import {
  SprintEstimationCancelledError,
  SprintEstimationDataError,
  SprintEstimationForbiddenError,
  SprintEstimationLimitError,
  SprintEstimationNotFoundError,
  SprintEstimationUnauthenticatedError,
} from '../../src/routes/api/sprints/sprints.errors';
import type { SprintEstimationService } from '../../src/routes/api/sprints/sprint-estimation.service';
import type {
  SprintBurndownService,
  SprintsService,
} from '../../src/routes/api/sprints/sprints.service';
import { MOCK_AUTH_USER_ID } from '../helpers/mock-api-auth';
import { withMountedRouter } from '../helpers/route-test.harness';

const SPRINT_ID = '22222222-2222-4222-8222-222222222222';
const estimateSprint = vi.fn();

const router = createSprintsRouter({
  sprintsService: {} as SprintsService,
  sprintBurndownService: {} as SprintBurndownService,
  sprintEstimationService: {
    generate: estimateSprint,
  } as unknown as SprintEstimationService,
});

function postEstimate(
  baseUrl: string,
  options: {
    mountPath?: '/api/v1/sprints' | '/api/sprints';
    sprintId?: string;
    token?: string | null;
    signal?: AbortSignal;
  } = {}
) {
  const {
    mountPath = '/api/v1/sprints',
    sprintId = SPRINT_ID,
    token = 'valid-token',
    signal,
  } = options;
  return fetch(`${baseUrl}${mountPath}/${sprintId}/estimates`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    signal,
  });
}

describe('POST /api/v1/sprints/:id/estimates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the validated sprint estimation response envelope', async () => {
    const result = {
      sprintId: SPRINT_ID,
      aiStatus: 'generated',
      estimates: [
        {
          workItemId: '33333333-3333-4333-8333-333333333333',
          suggestedHours: 8,
          minimumHours: 6,
          maximumHours: 10,
          confidence: 'medium',
          source: 'similar_history',
          evidenceCount: 4,
          roughEstimate: false,
          rationale: 'AI estimate based on bounded historical evidence.',
          estimationMethod: 'ai',
          fallbackReason: null,
        },
      ],
    } as const;
    estimateSprint.mockResolvedValueOnce(result);

    await withMountedRouter('/api/v1/sprints', router, async (baseUrl) => {
      const response = await postEstimate(baseUrl);

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        data: result,
        error: null,
      });
    });
    expect(estimateSprint).toHaveBeenCalledWith(
      MOCK_AUTH_USER_ID,
      SPRINT_ID,
      expect.any(AbortSignal)
    );
    const signal = estimateSprint.mock.calls[0]?.[2] as AbortSignal;
    expect(signal).toBeInstanceOf(AbortSignal);
    expect(signal.aborted).toBe(false);
  });

  it('rejects unauthenticated requests before calling the service', async () => {
    await withMountedRouter('/api/v1/sprints', router, async (baseUrl) => {
      const response = await postEstimate(baseUrl, { token: null });

      expect(response.status).toBe(401);
      await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' });
    });
    expect(estimateSprint).not.toHaveBeenCalled();
  });

  it('serves the existing unversioned API alias', async () => {
    estimateSprint.mockResolvedValueOnce({
      sprintId: SPRINT_ID,
      aiStatus: 'empty',
      estimates: [],
    });

    await withMountedRouter('/api/sprints', router, async (baseUrl) => {
      const response = await postEstimate(baseUrl, {
        mountPath: '/api/sprints',
      });

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        data: { sprintId: SPRINT_ID, aiStatus: 'empty', estimates: [] },
        error: null,
      });
    });
  });

  it('rejects an invalid sprint id before calling the service', async () => {
    await withMountedRouter('/api/v1/sprints', router, async (baseUrl) => {
      const response = await postEstimate(baseUrl, {
        sprintId: 'not-a-uuid',
      });

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        data: null,
        error: 'Invalid sprint id',
      });
    });
    expect(estimateSprint).not.toHaveBeenCalled();
  });

  it.each([
    [new SprintEstimationUnauthenticatedError(), 401, 'Unauthorized'],
    [new SprintEstimationForbiddenError(), 403, 'Forbidden'],
    [new SprintEstimationNotFoundError(), 404, 'Sprint not found'],
    [
      new SprintEstimationLimitError(),
      422,
      'Sprint exceeds the maximum of 200 estimable work items.',
    ],
  ])('maps typed service errors safely', async (error, status, message) => {
    estimateSprint.mockRejectedValueOnce(error);

    await withMountedRouter('/api/v1/sprints', router, async (baseUrl) => {
      const response = await postEstimate(baseUrl);

      expect(response.status).toBe(status);
      await expect(response.json()).resolves.toEqual({
        data: null,
        error: message,
      });
    });
  });

  it('does not expose internal repository or provider errors', async () => {
    estimateSprint.mockRejectedValueOnce(
      new SprintEstimationDataError('database secret: provider-token')
    );

    await withMountedRouter('/api/v1/sprints', router, async (baseUrl) => {
      const response = await postEstimate(baseUrl);
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body).toEqual({ data: null, error: 'Failed to estimate sprint' });
      expect(JSON.stringify(body)).not.toMatch(/secret|provider-token/);
    });
  });

  it('aborts service work when the client disconnects', async () => {
    let observedSignal: AbortSignal | undefined;
    estimateSprint.mockImplementationOnce(
      async (_actorId: string, _sprintId: string, signal?: AbortSignal) => {
        observedSignal = signal;
        if (!signal) throw new Error('missing cancellation signal');
        await new Promise<void>((resolve) => {
          signal.addEventListener('abort', () => resolve(), { once: true });
        });
        throw new SprintEstimationCancelledError();
      }
    );

    await withMountedRouter('/api/v1/sprints', router, async (baseUrl) => {
      const controller = new AbortController();
      const pending = postEstimate(baseUrl, { signal: controller.signal });
      await vi.waitFor(() => expect(observedSignal).toBeDefined());

      controller.abort();

      await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
      await vi.waitFor(() => expect(observedSignal?.aborted).toBe(true));
    });
  });
});
