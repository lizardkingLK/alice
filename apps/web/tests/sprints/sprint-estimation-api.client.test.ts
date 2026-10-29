import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/api-fetch.helper';
import { SessionExpiredError } from '@/lib/errors/session-expired';
import { apiFetch } from '@/lib/api/api-fetch.mutations.use.client';
import { generateSprintEstimates } from '@/app/sprints/_services/sprint-estimation.mutations.client';

vi.mock('@/lib/api/api-fetch.mutations.use.client', () => ({
  apiFetch: vi.fn(),
}));

const SPRINT_ID = '11111111-1111-4111-8111-111111111111';
const WORK_ITEM_ID = '22222222-2222-4222-8222-222222222222';

const VALID_RESPONSE = {
  sprintId: SPRINT_ID,
  aiStatus: 'generated' as const,
  estimates: [
    {
      workItemId: WORK_ITEM_ID,
      suggestedHours: 8,
      minimumHours: 6,
      maximumHours: 10,
      confidence: 'high' as const,
      source: 'assignee_history' as const,
      evidenceCount: 7,
      roughEstimate: false,
      rationale: 'Comparable completed work supports this range.',
      estimationMethod: 'ai' as const,
      fallbackReason: null,
    },
  ],
};

describe('generateSprintEstimates', () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset();
  });

  it('posts without a body through the authenticated API client', async () => {
    vi.mocked(apiFetch).mockResolvedValue({ data: VALID_RESPONSE });

    await expect(generateSprintEstimates(SPRINT_ID)).resolves.toEqual(
      VALID_RESPONSE
    );

    expect(apiFetch).toHaveBeenCalledTimes(1);
    expect(apiFetch).toHaveBeenCalledWith(
      `/api/v1/sprints/${SPRINT_ID}/estimates`,
      {
        method: 'POST',
        skipDatabaseBusyRetry: true,
        timeoutMs: 60_000,
      }
    );
  });

  it('forwards an optional cancellation signal', async () => {
    vi.mocked(apiFetch).mockResolvedValue({ data: VALID_RESPONSE });
    const controller = new AbortController();

    await generateSprintEstimates(SPRINT_ID, controller.signal);

    expect(apiFetch).toHaveBeenCalledWith(
      `/api/v1/sprints/${SPRINT_ID}/estimates`,
      {
        method: 'POST',
        skipDatabaseBusyRetry: true,
        timeoutMs: 60_000,
        signal: controller.signal,
      }
    );
  });

  it('rejects malformed response data', async () => {
    vi.mocked(apiFetch).mockResolvedValue({
      data: { ...VALID_RESPONSE, aiStatus: 'generated', estimates: [] },
    });

    await expect(generateSprintEstimates(SPRINT_ID)).rejects.toThrow(
      /invalid sprint estimation response/i
    );
  });

  it('rejects estimate hours that are not in half-hour increments', async () => {
    vi.mocked(apiFetch).mockResolvedValue({
      data: {
        ...VALID_RESPONSE,
        estimates: [
          {
            ...VALID_RESPONSE.estimates[0],
            suggestedHours: 8.25,
          },
        ],
      },
    });

    await expect(generateSprintEstimates(SPRINT_ID)).rejects.toThrow(
      /invalid sprint estimation response/i
    );
  });

  it('rejects a valid response for a different sprint', async () => {
    vi.mocked(apiFetch).mockResolvedValue({
      data: {
        ...VALID_RESPONSE,
        sprintId: '99999999-9999-4999-8999-999999999999',
      },
    });

    await expect(generateSprintEstimates(SPRINT_ID)).rejects.toThrow(
      /invalid sprint estimation response/i
    );
  });

  it('preserves session-expiry failures from the authenticated client', async () => {
    const error = new SessionExpiredError('/login?next=%2Fbacklog');
    vi.mocked(apiFetch).mockRejectedValue(error);

    await expect(generateSprintEstimates(SPRINT_ID)).rejects.toBe(error);
    expect(apiFetch).toHaveBeenCalledTimes(1);
  });

  it('preserves API errors without adding an automatic retry', async () => {
    const error = new ApiError('Forbidden', 403);
    vi.mocked(apiFetch).mockRejectedValue(error);

    await expect(generateSprintEstimates(SPRINT_ID)).rejects.toBe(error);
    expect(apiFetch).toHaveBeenCalledTimes(1);
  });
});
