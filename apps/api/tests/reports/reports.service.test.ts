import {
  generateReportResponseSchema,
  type DailyReportAiInsights,
} from '@repo/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReportsRepository } from '../../src/routes/api/reports/reports.repository';
import {
  ReportsAiInsightsError,
  type ReportsAiInsightsService,
} from '../../src/routes/api/reports/reports.ai-insights.service';
import {
  ReportAccessError,
  ReportsService,
} from '../../src/routes/api/reports/reports.service';

const {
  generateAiInsightsMock,
  listAccessibleProjectIdsMock,
  listDailyReportItemsMock,
} = vi.hoisted(() => ({
  generateAiInsightsMock: vi.fn(),
  listAccessibleProjectIdsMock: vi.fn(),
  listDailyReportItemsMock: vi.fn(),
}));

const repository = {
  listAccessibleProjectIds: listAccessibleProjectIdsMock,
  listDailyReportItems: listDailyReportItemsMock,
} as unknown as ReportsRepository;
const aiInsightsService = {
  generate: generateAiInsightsMock,
} as unknown as Pick<ReportsAiInsightsService, 'generate'>;

const NOW = () => new Date('2026-10-20T12:00:00.000Z');

const service = new ReportsService(repository, NOW, aiInsightsService);

const ACTOR_ID = '22222222-2222-4222-8222-222222222222';
const PROJECT_ID = '33333333-3333-4333-8333-333333333333';
const OTHER_PROJECT_ID = '55555555-5555-4555-8555-555555555555';
const SPRINT_ID = '44444444-4444-4444-8444-444444444444';
const AI_INSIGHTS: DailyReportAiInsights = {
  completedWork: ['Completed the release checklist.'],
  importantInProgress: ['Quality review is in progress.'],
  pendingTasks: ['Documentation remains pending.'],
  blockedAndOverdue: [],
  potentialRisks: ['The review may affect the delivery date.'],
  upcomingDeadlines: ['Documentation is due this week.'],
  nextPriorities: ['Finish quality review.'],
  overallProgress: 'The selected assigned work is progressing.',
};

describe('ReportsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listAccessibleProjectIdsMock.mockResolvedValue([PROJECT_ID]);
    listDailyReportItemsMock.mockResolvedValue([]);
    generateAiInsightsMock.mockResolvedValue(AI_INSIGHTS);
  });

  it('generates deterministic snapshot, Markdown, and metadata', async () => {
    const result = await service.generate(ACTOR_ID, {
      reportType: 'daily',
      reportDate: '2026-10-20',
      timezone: 'Asia/Colombo',
      verbosity: 'standard',
      projectIds: [PROJECT_ID],
      sprintIds: [SPRINT_ID],
    });

    expect(listDailyReportItemsMock).toHaveBeenCalledWith({
      actorId: ACTOR_ID,
      projectIds: [PROJECT_ID],
      sprintIds: [SPRINT_ID],
      start: new Date('2026-10-19T18:30:00.000Z'),
      endExclusive: new Date('2026-10-20T18:30:00.000Z'),
    });
    expect(result.snapshot.summary.completed).toBe(0);
    expect(result.markdown).toContain('# Daily Report — 2026-10-20');
    expect(result.metadata).toEqual({
      reportType: 'daily',
      generatedAt: '2026-10-20T12:00:00.000Z',
      reportDate: '2026-10-20',
      timezone: 'Asia/Colombo',
      verbosity: 'standard',
      filters: { projectIds: [PROJECT_ID], sprintIds: [SPRINT_ID] },
      upcomingDeadlineDays: 7,
    });
    expect(result).not.toHaveProperty('aiInsights');
    expect(result).not.toHaveProperty('aiInsightsStatus');
    expect(generateAiInsightsMock).not.toHaveBeenCalled();
  });

  it('does not invoke AI when insights are explicitly disabled', async () => {
    const result = await service.generate(ACTOR_ID, {
      reportType: 'daily',
      reportDate: '2026-10-20',
      timezone: 'UTC',
      verbosity: 'standard',
      includeAiInsights: false,
    });

    expect(generateAiInsightsMock).not.toHaveBeenCalled();
    expect(result).not.toHaveProperty('aiInsights');
    expect(result).not.toHaveProperty('aiInsightsStatus');
  });

  it('adds validated AI insights without changing the deterministic report', async () => {
    const request = {
      reportType: 'daily' as const,
      reportDate: '2026-10-20',
      timezone: 'Asia/Colombo',
      verbosity: 'detailed' as const,
      projectIds: [PROJECT_ID],
      sprintIds: [SPRINT_ID],
    };
    const deterministic = await service.generate(ACTOR_ID, request);

    const result = await service.generate(ACTOR_ID, {
      ...request,
      includeAiInsights: true,
    });

    expect(generateAiInsightsMock).toHaveBeenCalledOnce();
    expect(generateAiInsightsMock).toHaveBeenCalledWith(result.snapshot);
    expect(
      listDailyReportItemsMock.mock.invocationCallOrder.at(-1)
    ).toBeLessThan(generateAiInsightsMock.mock.invocationCallOrder[0]!);
    expect(result).toMatchObject({
      aiInsightsStatus: 'generated',
      aiInsights: AI_INSIGHTS,
    });
    expect(result.snapshot).toEqual(deterministic.snapshot);
    expect(result.markdown).toBe(deterministic.markdown);
    expect(result.metadata).toEqual(deterministic.metadata);
    expect(generateReportResponseSchema.parse(result)).toEqual(result);
  });

  it.each([
    [
      'missing provider configuration',
      new ReportsAiInsightsError(
        'configuration',
        'AI report insights are not configured.'
      ),
    ],
    ['a provider error', new Error('provider secret must not escape')],
    [
      'a timeout',
      new ReportsAiInsightsError(
        'timeout',
        'AI report insights generation timed out.'
      ),
    ],
    [
      'an invalid response',
      new ReportsAiInsightsError(
        'invalid_response',
        'The AI provider returned invalid report insights.'
      ),
    ],
  ])(
    'returns the deterministic report with unavailable status after %s',
    async (_label, error) => {
      generateAiInsightsMock.mockRejectedValue(error);

      const result = await service.generate(ACTOR_ID, {
        reportType: 'daily',
        reportDate: '2026-10-20',
        timezone: 'UTC',
        verbosity: 'standard',
        includeAiInsights: true,
      });

      expect(result.snapshot.summary).toEqual({
        completed: 0,
        inProgress: 0,
        pending: 0,
        blocked: 0,
        dueToday: 0,
        overdue: 0,
        upcomingDeadlines: 0,
      });
      expect(result.markdown).toContain('# Daily Report');
      expect(result).toMatchObject({ aiInsightsStatus: 'unavailable' });
      expect(result).not.toHaveProperty('aiInsights');
      expect(generateReportResponseSchema.parse(result)).toEqual(result);
    }
  );

  it('keeps existing constructor usage compatible when AI is requested', async () => {
    const serviceWithoutAi = new ReportsService(repository, NOW);

    const result = await serviceWithoutAi.generate(ACTOR_ID, {
      reportType: 'daily',
      reportDate: '2026-10-20',
      timezone: 'UTC',
      verbosity: 'standard',
      includeAiInsights: true,
    });

    expect(result).toMatchObject({ aiInsightsStatus: 'unavailable' });
    expect(result).not.toHaveProperty('aiInsights');
  });

  it('uses every accessible project when no project filter is supplied', async () => {
    listAccessibleProjectIdsMock.mockResolvedValue([
      PROJECT_ID,
      OTHER_PROJECT_ID,
    ]);

    await service.generate(ACTOR_ID, {
      reportType: 'daily',
      reportDate: '2026-10-20',
      timezone: 'UTC',
      verbosity: 'concise',
    });

    expect(listDailyReportItemsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        projectIds: [PROJECT_ID, OTHER_PROJECT_ID],
      })
    );
  });

  it('rejects a project filter containing any inaccessible project', async () => {
    await expect(
      service.generate(ACTOR_ID, {
        reportType: 'daily',
        reportDate: '2026-10-20',
        timezone: 'UTC',
        verbosity: 'standard',
        projectIds: [PROJECT_ID, OTHER_PROJECT_ID],
      })
    ).rejects.toBeInstanceOf(ReportAccessError);
    expect(listDailyReportItemsMock).not.toHaveBeenCalled();
    expect(generateAiInsightsMock).not.toHaveBeenCalled();
  });
});
