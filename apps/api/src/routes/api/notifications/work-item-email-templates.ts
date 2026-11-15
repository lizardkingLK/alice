import type { EmailMessage } from '../../../lib/email/email-transport';
import {
  buildValidatedFrontendUrl,
  escapeEmailHtml,
  normalizeEmailAddress,
  normalizeEmailDisplayText,
} from '../../../lib/email/email-content';
import { buildEmailIdempotencyKey } from '../../../lib/email/email-delivery-policy';

type BaseWorkItemEmailInput = {
  readonly recipientEmail: string;
  readonly recipientName: string;
  readonly actorName: string;
  readonly workItemId: string;
  readonly workItemTitle: string;
  readonly frontendUrl: string;
  readonly notificationId: string;
};

type EmailContent = {
  readonly heading: string;
  readonly greetingName: string;
  readonly paragraphs: readonly string[];
  readonly actionLabel: string;
  readonly actionUrl: string;
  readonly subject: string;
};

function renderEmail(
  content: EmailContent
): Pick<EmailMessage, 'text' | 'html'> {
  const text = [
    `Hello ${content.greetingName},`,
    '',
    ...content.paragraphs,
    '',
    `${content.actionLabel}: ${content.actionUrl}`,
  ].join('\n');
  const paragraphs = content.paragraphs
    .map((paragraph) => `<p>${escapeEmailHtml(paragraph)}</p>`)
    .join('');
  const html = `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#f6f7f9;color:#1f2937;font-family:Arial,sans-serif">
    <div style="max-width:600px;margin:0 auto;padding:32px 20px">
      <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:32px">
        <h1 style="margin:0 0 20px;font-size:24px">${escapeEmailHtml(content.heading)}</h1>
        <p>Hello ${escapeEmailHtml(content.greetingName)},</p>
        ${paragraphs}
        <p style="margin:28px 0">
          <a href="${escapeEmailHtml(content.actionUrl)}" style="display:inline-block;border-radius:8px;background:#111827;color:#ffffff;padding:12px 18px;text-decoration:none">${escapeEmailHtml(content.actionLabel)}</a>
        </p>
      </div>
    </div>
  </body>
</html>`;
  return { text, html };
}

function buildWorkItemEmail(
  input: BaseWorkItemEmailInput,
  kind: string,
  content: Omit<EmailContent, 'greetingName' | 'actionUrl'>
): EmailMessage {
  const to = normalizeEmailAddress(input.recipientEmail);
  const greetingName = normalizeEmailDisplayText(input.recipientName, 'there');
  const actionUrl = buildValidatedFrontendUrl(input.frontendUrl, [
    'work-items',
    input.workItemId,
  ]);
  const rendered = renderEmail({ ...content, greetingName, actionUrl });
  return {
    to,
    subject: content.subject,
    ...rendered,
    idempotencyKey: buildEmailIdempotencyKey(kind, input.notificationId),
  };
}

export function buildWorkItemAssignmentEmail(
  input: BaseWorkItemEmailInput
): EmailMessage {
  const actor = normalizeEmailDisplayText(input.actorName, 'A teammate');
  const title = normalizeEmailDisplayText(input.workItemTitle, 'a work item');
  return buildWorkItemEmail(input, 'work-item-assignment', {
    heading: 'Work item assigned',
    subject: `You've been assigned: ${title}`,
    paragraphs: [`${actor} assigned "${title}" to you in Alice.`],
    actionLabel: 'Open work item',
  });
}

export function buildWorkItemReassignmentEmail(
  input: BaseWorkItemEmailInput & { readonly newAssigneeName?: string | null }
): EmailMessage {
  const actor = normalizeEmailDisplayText(input.actorName, 'A teammate');
  const title = normalizeEmailDisplayText(input.workItemTitle, 'a work item');
  const newAssignee = input.newAssigneeName
    ? normalizeEmailDisplayText(input.newAssigneeName, 'another teammate')
    : null;
  const change = newAssignee
    ? `reassigned "${title}" to ${newAssignee}`
    : `removed your assignment from "${title}"`;
  return buildWorkItemEmail(input, 'work-item-reassignment', {
    heading: 'Work item reassigned',
    subject: `Assignment changed: ${title}`,
    paragraphs: [`${actor} ${change} in Alice.`],
    actionLabel: 'View work item',
  });
}

export function buildWorkItemStatusChangeEmail(
  input: BaseWorkItemEmailInput & {
    readonly previousStatus: string;
    readonly nextStatus: string;
  }
): EmailMessage {
  const actor = normalizeEmailDisplayText(input.actorName, 'A teammate');
  const title = normalizeEmailDisplayText(input.workItemTitle, 'a work item');
  const previousStatus = normalizeEmailDisplayText(
    input.previousStatus,
    'Unknown'
  );
  const nextStatus = normalizeEmailDisplayText(input.nextStatus, 'Unknown');
  return buildWorkItemEmail(input, 'work-item-status-change', {
    heading: 'Work item status changed',
    subject: `Status changed: ${title}`,
    paragraphs: [
      `${actor} changed "${title}" from ${previousStatus} to ${nextStatus}.`,
    ],
    actionLabel: 'View work item',
  });
}

export function buildWeeklyProjectReportEmail(input: {
  readonly recipientEmail: string;
  readonly recipientName: string;
  readonly projectId: string;
  readonly projectName: string;
  readonly weekLabel: string;
  readonly completedCount: number;
  readonly createdCount: number;
  readonly overdueCount: number;
  readonly pendingCount?: number;
  readonly progressPercent?: number;
  readonly statusSummary?: Readonly<Record<string, number>>;
  readonly frontendUrl: string;
  readonly notificationId: string;
}): EmailMessage {
  const to = normalizeEmailAddress(input.recipientEmail);
  const greetingName = normalizeEmailDisplayText(input.recipientName, 'there');
  const projectName = normalizeEmailDisplayText(
    input.projectName,
    'Your project'
  );
  const weekLabel = normalizeEmailDisplayText(input.weekLabel, 'This week');
  const actionUrl = buildValidatedFrontendUrl(input.frontendUrl, [
    'projects',
    input.projectId,
  ]);
  const paragraphs = [
    `${weekLabel} in ${projectName}:`,
    `${Math.max(0, input.completedCount)} completed, ${Math.max(0, input.createdCount)} created, and ${Math.max(0, input.overdueCount)} overdue.`,
  ];
  if (input.pendingCount !== undefined && input.progressPercent !== undefined) {
    paragraphs.push(
      `${Math.max(0, input.pendingCount)} pending; overall progress is ${Math.min(100, Math.max(0, input.progressPercent))}%.`
    );
  }
  if (input.statusSummary) {
    const summary = Object.entries(input.statusSummary)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([status, count]) => `${status}: ${Math.max(0, count)}`)
      .join(', ');
    if (summary) paragraphs.push(`Current status summary: ${summary}.`);
  }
  const content = {
    heading: 'Weekly project report',
    subject: `${projectName} weekly report`,
    greetingName,
    paragraphs,
    actionLabel: 'Open project',
    actionUrl,
  };
  return {
    to,
    subject: content.subject,
    ...renderEmail(content),
    idempotencyKey: buildEmailIdempotencyKey(
      'weekly-project-report',
      input.notificationId
    ),
  };
}
