import type {
  DailyReportAiInsights,
  DailyReportSnapshot,
  DailyReportWorkItem,
  ReportVerbosity,
} from '@repo/types';
import { UPCOMING_DEADLINE_DAYS } from './reports.aggregation';

function escapeMarkdown(value: string): string {
  return value
    .replaceAll('\\', String.raw`\\`)
    .replaceAll('[', String.raw`\[`)
    .replaceAll(']', String.raw`\]`)
    .replaceAll(/([*_`|])/g, String.raw`\$1`)
    .replaceAll(/\s+/g, ' ')
    .trim();
}

function escapeAiInsightMarkdown(value: string): string {
  return escapeMarkdown(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll(/\b(https?|ftp):(?=\/\/)/gi, '$1&#58;')
    .replaceAll(/\bmailto:/gi, 'mailto&#58;')
    .replaceAll(/\bwww\./gi, 'www&#46;')
    .replaceAll('@', '&#64;')
    .replaceAll(/([{}()#+!>~-])/g, String.raw`\$1`);
}

function insightListSection(
  heading: string,
  items: readonly string[]
): string | null {
  const lines = items
    .map(escapeAiInsightMarkdown)
    .filter((item) => item.length > 0)
    .map((item) => `- ${item}`);
  if (lines.length === 0) return null;
  return [`### ${heading}`, '', ...lines].join('\n');
}

const AI_INSIGHTS_HEADING = '## AI Insights';

export function appendDailyReportAiInsightsMarkdown(
  markdown: string,
  insights: DailyReportAiInsights
): string {
  if (/(?:^|\n)## AI Insights(?:\n|$)/.test(markdown)) return markdown;

  const sections = [
    insightListSection('Completed Work', insights.completedWork),
    insightListSection(
      'Important In-Progress Work',
      insights.importantInProgress
    ),
    insightListSection('Pending Tasks', insights.pendingTasks),
    insightListSection('Blocked and Overdue Work', insights.blockedAndOverdue),
    insightListSection('Potential Risks', insights.potentialRisks),
    insightListSection('Upcoming Deadlines', insights.upcomingDeadlines),
    insightListSection('Suggested Next Priorities', insights.nextPriorities),
  ].filter((section): section is string => section !== null);
  const overallProgress = escapeAiInsightMarkdown(insights.overallProgress);
  if (overallProgress) {
    sections.push(['### Overall Progress', '', overallProgress].join('\n'));
  }

  let separator = '\n\n';
  if (markdown.endsWith('\n\n')) {
    separator = '';
  } else if (markdown.endsWith('\n')) {
    separator = '\n';
  }
  return `${markdown}${separator}${[AI_INSIGHTS_HEADING, ...sections].join('\n\n')}\n`;
}

function itemLine(
  item: DailyReportWorkItem,
  verbosity: ReportVerbosity
): string {
  const title = escapeMarkdown(item.title);
  if (verbosity === 'concise') {
    return `- ${title}`;
  }

  const basics = [
    `${item.project.key} — ${escapeMarkdown(item.project.name)}`,
    item.priority,
    ...(item.dueDate ? [`due ${item.dueDate}`] : []),
  ];
  let line = `- **${title}** — ${basics.join(', ')}`;
  if (verbosity === 'detailed') {
    const details = [
      `type: ${item.type}`,
      `state: ${escapeMarkdown(item.stateId)}`,
      ...(item.sprint ? [`sprint: ${escapeMarkdown(item.sprint.name)}`] : []),
      ...(item.storyPoints !== null
        ? [`${item.storyPoints} ${item.storyPoints === 1 ? 'point' : 'points'}`]
        : []),
      `id: ${item.id}`,
    ];
    line += `\n  - ${details.join('; ')}`;
  }
  return line;
}

function section(
  heading: string,
  items: readonly DailyReportWorkItem[],
  emptyMessage: string,
  verbosity: ReportVerbosity
): string {
  return [
    `## ${heading}`,
    '',
    items.length > 0
      ? items.map((item) => itemLine(item, verbosity)).join('\n')
      : emptyMessage,
  ].join('\n');
}

export function renderDailyReportMarkdown(
  snapshot: DailyReportSnapshot,
  verbosity: ReportVerbosity
): string {
  const summary = snapshot.summary;
  const summaryLines =
    verbosity === 'concise'
      ? [
          `Completed: ${summary.completed}; ongoing: ${summary.inProgress}; pending: ${summary.pending}; blocked: ${summary.blocked}.`,
        ]
      : [
          `- Completed: **${summary.completed}**`,
          `- Ongoing: **${summary.inProgress}**`,
          `- Pending: **${summary.pending}**`,
          `- Blocked: **${summary.blocked}**`,
          `- Due today: **${summary.dueToday}**`,
          `- Overdue: **${summary.overdue}**`,
          `- Upcoming deadlines: **${summary.upcomingDeadlines}**`,
        ];

  const deadlines = [
    section(
      'Due Today',
      snapshot.dueToday,
      'No tasks are due on this date.',
      verbosity
    ),
    section('Overdue', snapshot.overdue, 'No tasks are overdue.', verbosity),
    section(
      'Upcoming',
      snapshot.upcomingDeadlines,
      `No upcoming deadlines in the next ${UPCOMING_DEADLINE_DAYS} days.`,
      verbosity
    ),
  ].join('\n\n');

  return [
    `# Daily Report — ${snapshot.reportDate}`,
    '',
    `Timezone: ${snapshot.timezone}`,
    '',
    '## Summary',
    '',
    ...summaryLines,
    '',
    section(
      'Completed Tasks',
      snapshot.completed,
      'No tasks completed on this date.',
      verbosity
    ),
    '',
    section(
      'Ongoing Tasks',
      snapshot.inProgress,
      'No tasks are currently in progress.',
      verbosity
    ),
    '',
    section(
      'Pending Tasks',
      snapshot.pending,
      'No tasks are pending.',
      verbosity
    ),
    '',
    section(
      'Blocked Tasks',
      snapshot.blocked,
      'No tasks are explicitly marked as blocked.',
      verbosity
    ),
    '',
    '## Deadlines',
    '',
    deadlines,
    '',
  ].join('\n');
}
