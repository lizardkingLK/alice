import { describe, expect, it } from 'vitest';
import type { DailyReportSnapshot } from '@repo/types';
import { renderDailyReportMarkdown } from '../../src/routes/api/reports/reports.markdown';

const emptySnapshot: DailyReportSnapshot = {
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
};

describe('renderDailyReportMarkdown', () => {
  it('renders every required section for an empty report', () => {
    const markdown = renderDailyReportMarkdown(emptySnapshot, 'standard');

    expect(markdown).toContain('# Daily Report — 2026-10-20');
    expect(markdown).toContain('## Summary');
    expect(markdown).toContain('## Completed Tasks');
    expect(markdown).toContain('## Ongoing Tasks');
    expect(markdown).toContain('## Pending Tasks');
    expect(markdown).toContain('## Blocked Tasks');
    expect(markdown).toContain('## Deadlines');
    expect(markdown).toContain('No tasks completed on this date.');
    expect(markdown).toContain('No upcoming deadlines in the next 7 days.');
  });

  it('adds state, sprint, points, and identifiers only in detailed output', () => {
    const workItem = {
      id: '11111111-1111-4111-8111-111111111111',
      title: 'Escape *markdown*',
      type: 'Task' as const,
      priority: 'high' as const,
      project: { id: 'p1', key: 'AL', name: 'Alice' },
      sprint: { id: 's1', name: 'Sprint 1' },
      dueDate: '2026-10-20',
      storyPoints: 5,
      statusCategory: 'in_progress' as const,
      stateId: 'quality-review',
      doneAt: null,
    };
    const snapshot = {
      ...emptySnapshot,
      summary: { ...emptySnapshot.summary, inProgress: 1 },
      inProgress: [workItem],
    };

    const concise = renderDailyReportMarkdown(snapshot, 'concise');
    const detailed = renderDailyReportMarkdown(snapshot, 'detailed');

    expect(concise).toContain('Escape \\*markdown\\*');
    expect(concise).not.toContain('quality-review');
    expect(detailed).toContain('quality-review');
    expect(detailed).toContain('Sprint 1');
    expect(detailed).toContain('5 points');
    expect(detailed).toContain(workItem.id);
  });
});
