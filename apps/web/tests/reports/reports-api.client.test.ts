import { beforeEach, describe, expect, it, vi } from 'vitest';
import { generateDailyReport } from '@/app/reports/_services/reports.mutations.client';
import { apiFetch } from '@/lib/api/api-fetch.mutations.use.client';

vi.mock('@/lib/api/api-fetch.mutations.use.client', () => ({
  apiFetch: vi.fn(),
}));

const VALID_RESPONSE = {
  snapshot: {
    reportDate: '2026-10-20',
    timezone: 'UTC',
    utcRange: {
      start: '2026-10-20T00:00:00.000Z',
      endExclusive: '2026-10-21T00:00:00.000Z',
    },
    summary: {
      completed: 0,
      inProgress: 0,
      pending: 0,
      blocked: 0,
      dueToday: 0,
      overdue: 0,
      upcomingDeadlines: 0,
    },
    completed: [],
    inProgress: [],
    pending: [],
    blocked: [],
    dueToday: [],
    overdue: [],
    upcomingDeadlines: [],
  },
  markdown: '# Daily Report\n\nNo matching work items.',
  metadata: {
    reportType: 'daily' as const,
    generatedAt: '2026-10-20T12:00:00.000Z',
    reportDate: '2026-10-20',
    timezone: 'UTC',
    verbosity: 'standard' as const,
    filters: { projectIds: [], sprintIds: [] },
    upcomingDeadlineDays: 7,
  },
};

describe('generateDailyReport', () => {
  beforeEach(() => vi.mocked(apiFetch).mockReset());

  it('posts a validated request through the authenticated API client', async () => {
    vi.mocked(apiFetch).mockResolvedValue({ data: VALID_RESPONSE });
    const request = {
      reportType: 'daily' as const,
      reportDate: '2026-10-20',
      timezone: 'UTC',
      verbosity: 'standard' as const,
    };

    await expect(generateDailyReport(request)).resolves.toEqual(VALID_RESPONSE);
    expect(apiFetch).toHaveBeenCalledWith('/api/v1/reports/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
  });

  it('rejects invalid input before making a request', async () => {
    await expect(
      generateDailyReport({
        reportType: 'daily',
        reportDate: 'not-a-date',
        timezone: 'UTC',
        verbosity: 'standard',
      })
    ).rejects.toThrow(/date/i);
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('rejects malformed API responses', async () => {
    vi.mocked(apiFetch).mockResolvedValue({ data: { markdown: 42 } });

    await expect(
      generateDailyReport({
        reportType: 'daily',
        reportDate: '2026-10-20',
        timezone: 'UTC',
        verbosity: 'standard',
      })
    ).rejects.toThrow(/response/i);
  });
});
