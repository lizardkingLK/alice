import { describe, expect, it } from 'vitest';
import {
  dailyReportAiInsightsSchema,
  generateReportRequestSchema,
  generateReportResponseSchema,
} from '@repo/types';

const PROJECT_ID = '33333333-3333-4333-8333-333333333333';
const SPRINT_ID = '44444444-4444-4444-8444-444444444444';

const request = {
  reportType: 'daily' as const,
  reportDate: '2026-10-20',
  timezone: 'Asia/Colombo',
  projectIds: [PROJECT_ID],
  sprintIds: [SPRINT_ID],
};

const aiInsights = {
  completedWork: ['Completed the report contract review.'],
  importantInProgress: ['Daily report insights remain in progress.'],
  pendingTasks: ['Implement the read-only insights service.'],
  blockedAndOverdue: [],
  potentialRisks: ['Provider output may be unavailable.'],
  upcomingDeadlines: ['Review the next implementation step.'],
  nextPriorities: ['Preserve deterministic report data.'],
  overallProgress: 'The selected assigned work is progressing as expected.',
};

const response = {
  snapshot: {
    reportDate: '2026-10-20',
    timezone: 'Asia/Colombo',
    utcRange: {
      start: '2026-10-19T18:30:00.000Z',
      endExclusive: '2026-10-20T18:30:00.000Z',
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
  markdown: '# Daily Report',
  metadata: {
    reportType: 'daily' as const,
    generatedAt: '2026-10-20T12:00:00.000Z',
    reportDate: '2026-10-20',
    timezone: 'Asia/Colombo',
    verbosity: 'standard' as const,
    filters: {
      projectIds: [PROJECT_ID],
      sprintIds: [SPRINT_ID],
    },
    upcomingDeadlineDays: 7,
  },
};

describe('generateReportRequestSchema', () => {
  it('keeps an existing request valid and defaults AI insights to false', () => {
    expect(generateReportRequestSchema.parse(request)).toEqual({
      ...request,
      verbosity: 'standard',
      includeAiInsights: false,
    });
  });

  it.each([true, false])(
    'accepts includeAiInsights set to %s',
    (includeAiInsights) => {
      expect(
        generateReportRequestSchema.parse({ ...request, includeAiInsights })
          .includeAiInsights
      ).toBe(includeAiInsights);
    }
  );

  it.each(['true', 1])(
    'rejects non-boolean includeAiInsights value %s',
    (includeAiInsights) => {
      expect(
        generateReportRequestSchema.safeParse({
          ...request,
          includeAiInsights,
        }).success
      ).toBe(false);
    }
  );

  it.each([
    ['invalid calendar date', { reportDate: '2026-02-30', timezone: 'UTC' }],
    [
      'invalid timezone',
      { reportDate: '2026-10-20', timezone: 'Mars/Olympus' },
    ],
    [
      'empty project filter',
      { reportDate: '2026-10-20', timezone: 'UTC', projectIds: [] },
    ],
    [
      'unknown report type',
      { reportType: 'review', reportDate: '2026-10-20', timezone: 'UTC' },
    ],
  ])('rejects %s', (_label, input) => {
    expect(
      generateReportRequestSchema.safeParse({ reportType: 'daily', ...input })
        .success
    ).toBe(false);
  });
});

describe('dailyReportAiInsightsSchema', () => {
  it('accepts structured insights with empty category arrays', () => {
    expect(dailyReportAiInsightsSchema.parse(aiInsights)).toEqual(aiInsights);
  });

  it('rejects unknown insight properties', () => {
    expect(
      dailyReportAiInsightsSchema.safeParse({
        ...aiInsights,
        projectCompletionPercentage: 75,
      }).success
    ).toBe(false);
  });

  it('rejects invalid insight field types', () => {
    expect(
      dailyReportAiInsightsSchema.safeParse({
        ...aiInsights,
        potentialRisks: 'No known risks',
      }).success
    ).toBe(false);
  });

  it('rejects insight arrays with more than 20 entries', () => {
    expect(
      dailyReportAiInsightsSchema.safeParse({
        ...aiInsights,
        completedWork: Array.from(
          { length: 21 },
          (_, index) => `Item ${index}`
        ),
      }).success
    ).toBe(false);
  });

  it.each(['array item', 'overall progress'])(
    'rejects an oversized %s',
    (field) => {
      const oversized = 'x'.repeat(1001);
      const input =
        field === 'array item'
          ? { ...aiInsights, completedWork: [oversized] }
          : { ...aiInsights, overallProgress: oversized };

      expect(dailyReportAiInsightsSchema.safeParse(input).success).toBe(false);
    }
  );
});

describe('generateReportResponseSchema', () => {
  it('keeps an existing response valid and preserves its report fields', () => {
    expect(generateReportResponseSchema.parse(response)).toEqual(response);
  });

  it('accepts valid structured AI insights', () => {
    const parsed = generateReportResponseSchema.parse({
      ...response,
      aiInsights,
    });

    expect(parsed.aiInsights).toEqual(aiInsights);
  });

  it.each(['not_requested', 'generated', 'unavailable'] as const)(
    'accepts the %s AI insights status',
    (aiInsightsStatus) => {
      expect(
        generateReportResponseSchema.parse({
          ...response,
          aiInsightsStatus,
        }).aiInsightsStatus
      ).toBe(aiInsightsStatus);
    }
  );

  it('rejects invalid AI insights in a response', () => {
    expect(
      generateReportResponseSchema.safeParse({
        ...response,
        aiInsights: { ...aiInsights, pendingTasks: [42] },
      }).success
    ).toBe(false);
  });

  it('rejects an invalid AI insights status', () => {
    expect(
      generateReportResponseSchema.safeParse({
        ...response,
        aiInsightsStatus: 'failed',
      }).success
    ).toBe(false);
  });
});
