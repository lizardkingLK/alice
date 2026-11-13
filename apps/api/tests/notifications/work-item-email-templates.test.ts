import { describe, expect, it } from 'vitest';
import {
  buildWeeklyProjectReportEmail,
  buildWorkItemAssignmentEmail,
  buildWorkItemReassignmentEmail,
  buildWorkItemStatusChangeEmail,
} from '../../src/routes/api/notifications/work-item-email-templates';

const base = {
  recipientEmail: 'member@example.com',
  recipientName: '<Taylor>',
  actorName: 'Alex <script>alert(1)</script>',
  workItemId: 'work/item id',
  workItemTitle: 'Fix <img src=x onerror=alert(1)>\r\nBcc: bad@example.com',
  frontendUrl: 'https://alice.example/config?secret=value',
  notificationId: '11111111-1111-4111-8111-111111111111',
};

describe('work-item email templates', () => {
  it('builds assignment email with escaped HTML and a validated link', () => {
    const email = buildWorkItemAssignmentEmail(base);

    expect(email.subject).not.toMatch(/[\r\n]/);
    expect(email.html).toContain('&lt;Taylor&gt;');
    expect(email.html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(email.html).not.toContain('<script>');
    expect(email.text).toContain(
      'https://alice.example/work-items/work%2Fitem%20id'
    );
    expect(email.text).not.toContain('secret=value');
    expect(email.idempotencyKey).toBe(
      `work-item-assignment:${base.notificationId}`
    );
  });

  it('builds reassignment and removal variants safely', () => {
    const reassigned = buildWorkItemReassignmentEmail({
      ...base,
      newAssigneeName: '<Morgan>',
    });
    const removed = buildWorkItemReassignmentEmail({
      ...base,
      newAssigneeName: null,
    });

    expect(reassigned.text).toContain('to <Morgan>');
    expect(reassigned.html).toContain('to &lt;Morgan&gt;');
    expect(removed.text).toContain('removed your assignment');
  });

  it('builds a status-change email without trusting status labels', () => {
    const email = buildWorkItemStatusChangeEmail({
      ...base,
      previousStatus: '<To Do>',
      nextStatus: '<Done>',
    });

    expect(email.text).toContain('from <To Do> to <Done>');
    expect(email.html).toContain('from &lt;To Do&gt; to &lt;Done&gt;');
  });

  it('builds a weekly report with non-negative counts and stable identity', () => {
    const email = buildWeeklyProjectReportEmail({
      recipientEmail: 'member@example.com',
      recipientName: 'Taylor',
      projectId: 'project/1',
      projectName: '<Apollo>',
      weekLabel: 'Week <42>',
      completedCount: 4,
      createdCount: 2,
      overdueCount: -3,
      frontendUrl: 'https://alice.example',
      notificationId: base.notificationId,
    });

    expect(email.text).toContain('4 completed, 2 created, and 0 overdue');
    expect(email.html).toContain('&lt;Apollo&gt;');
    expect(email.text).toContain('https://alice.example/projects/project%2F1');
    expect(email.idempotencyKey).toBe(
      `weekly-project-report:${base.notificationId}`
    );
  });

  it('rejects unsafe frontend URLs and recipient header injection', () => {
    expect(() =>
      buildWorkItemAssignmentEmail({ ...base, frontendUrl: 'javascript:x' })
    ).toThrow('Alice frontend URL must use HTTP or HTTPS.');
    expect(() =>
      buildWorkItemAssignmentEmail({
        ...base,
        recipientEmail: 'member@example.com\r\nBcc: bad@example.com',
      })
    ).toThrow('Recipient email is invalid.');
  });
});
