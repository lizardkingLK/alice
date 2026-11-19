import { describe, expect, it } from 'vitest';
import type { DailyReportAiInsights, DailyReportSnapshot } from '@repo/types';
import {
  appendDailyReportAiInsightsMarkdown,
  renderDailyReportMarkdown,
} from '../../src/routes/api/reports/reports.markdown';

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

const insights: DailyReportAiInsights = {
  completedWork: ['Release preparation was completed.'],
  importantInProgress: ['Quality review remains in progress.'],
  pendingTasks: ['Documentation is still pending.'],
  blockedAndOverdue: ['A dependency is blocking assigned work.'],
  potentialRisks: ['The dependency may affect delivery.'],
  upcomingDeadlines: ['Documentation is due this week.'],
  nextPriorities: ['Resolve the blocked dependency.'],
  overallProgress: 'The selected assigned work is progressing.',
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

describe('appendDailyReportAiInsightsMarkdown', () => {
  it('appends all insight sections in a stable order', () => {
    const original = renderDailyReportMarkdown(emptySnapshot, 'standard');
    const markdown = appendDailyReportAiInsightsMarkdown(original, insights);
    const headings = [
      '## AI Insights',
      '### Completed Work',
      '### Important In-Progress Work',
      '### Pending Tasks',
      '### Blocked and Overdue Work',
      '### Potential Risks',
      '### Upcoming Deadlines',
      '### Suggested Next Priorities',
      '### Overall Progress',
    ];

    expect(markdown.startsWith(original)).toBe(true);
    expect(markdown).toContain('- Release preparation was completed.');
    expect(markdown).toContain('The selected assigned work is progressing.');
    for (const [index, heading] of headings.entries()) {
      expect(markdown).toContain(heading);
      if (index > 0) {
        expect(markdown.indexOf(heading)).toBeGreaterThan(
          markdown.indexOf(headings[index - 1]!)
        );
      }
    }
  });

  it('omits empty list sections without inventing placeholder content', () => {
    const markdown = appendDailyReportAiInsightsMarkdown('base', {
      ...insights,
      completedWork: [],
      importantInProgress: [],
      pendingTasks: [],
      blockedAndOverdue: [],
      potentialRisks: [],
      upcomingDeadlines: [],
      nextPriorities: [],
    });

    expect(markdown).toContain('## AI Insights');
    expect(markdown).toContain('### Overall Progress');
    expect(markdown).not.toContain('### Completed Work');
    expect(markdown).not.toContain('### Pending Tasks');
    expect(markdown).not.toContain('\n- ');
    expect(markdown).not.toMatch(/no insights|none|nothing/i);
  });

  it('neutralizes Markdown, links, images, HTML, and embedded newlines', () => {
    const unsafe = [
      '# Injected heading',
      '[click me](https://evil.example/path)',
      '![image](https://evil.example/image.png)',
      '<script>alert(`unsafe`)</script>',
      '> misleading quote',
    ].join('\n');
    const markdown = appendDailyReportAiInsightsMarkdown('base', {
      ...insights,
      completedWork: [unsafe],
    });

    expect(markdown).toContain('\\# Injected heading');
    expect(markdown).toContain('\\[click me\\]');
    expect(markdown).not.toContain('\n# Injected heading');
    expect(markdown).not.toContain('[click me](https://');
    expect(markdown).not.toContain('![image]');
    expect(markdown).not.toContain('https://evil.example');
    expect(markdown).not.toContain('<script>');
    expect(markdown).not.toContain('\n> misleading quote');
    expect(markdown.match(/^#{2,3} .+$/gm)).toEqual([
      '## AI Insights',
      '### Completed Work',
      '### Important In-Progress Work',
      '### Pending Tasks',
      '### Blocked and Overdue Work',
      '### Potential Risks',
      '### Upcoming Deadlines',
      '### Suggested Next Priorities',
      '### Overall Progress',
    ]);
  });

  it('does not append a duplicate AI Insights section', () => {
    const once = appendDailyReportAiInsightsMarkdown('base', insights);
    const twice = appendDailyReportAiInsightsMarkdown(once, insights);

    expect(twice).toBe(once);
    expect(twice.match(/^## AI Insights$/gm)).toHaveLength(1);
  });
});
