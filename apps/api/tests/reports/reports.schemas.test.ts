import { describe, expect, it } from 'vitest';
import { generateReportRequestSchema } from '@repo/types';

const PROJECT_ID = '33333333-3333-4333-8333-333333333333';
const SPRINT_ID = '44444444-4444-4444-8444-444444444444';

describe('generateReportRequestSchema', () => {
  it('parses an extensible daily report request and defaults verbosity', () => {
    expect(
      generateReportRequestSchema.parse({
        reportType: 'daily',
        reportDate: '2026-10-20',
        timezone: 'Asia/Colombo',
        projectIds: [PROJECT_ID],
        sprintIds: [SPRINT_ID],
      })
    ).toEqual({
      reportType: 'daily',
      reportDate: '2026-10-20',
      timezone: 'Asia/Colombo',
      projectIds: [PROJECT_ID],
      sprintIds: [SPRINT_ID],
      verbosity: 'standard',
    });
  });

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
