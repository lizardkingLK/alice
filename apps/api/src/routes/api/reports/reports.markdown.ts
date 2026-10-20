import type {
  DailyReportSnapshot,
  DailyReportWorkItem,
  ReportVerbosity,
} from '@repo/types';
import { UPCOMING_DEADLINE_DAYS } from './reports.aggregation';

function escapeMarkdown(value: string): string {
  return value
    .replaceAll('\\', '\\\\')
    .replaceAll('[', '\\[')
    .replaceAll(']', '\\]')
    .replaceAll(/([*_`|])/g, '\\$1')
    .replaceAll(/\s+/g, ' ')
    .trim();
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
