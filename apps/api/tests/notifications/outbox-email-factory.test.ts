import { describe, expect, it } from 'vitest';
import { EmailTemplate } from '@repo/types/prisma';
import { StoredEventOutboxEmailFactory } from '../../src/routes/api/notifications/outbox-email-factory';
import type { ClaimedEmailOutboxItem } from '../../src/routes/api/notifications/email-outbox-processor';

const item: ClaimedEmailOutboxItem = {
  id: 'outbox-1',
  notificationId: '11111111-1111-4111-8111-111111111111',
  userId: 'user-1',
  recipientEmail: 'member@example.com',
  template: EmailTemplate.work_item_status_change,
  payload: {
    recipientName: 'Taylor',
    actorName: 'Snapshot actor',
    workItemId: 'work-item-1',
    workItemTitle: 'Snapshot title',
    previousStatus: 'To do',
    nextStatus: 'Done',
  },
  idempotencyKey:
    'work_item_status_change:11111111-1111-4111-8111-111111111111',
  attemptCount: 0,
  maxAttempts: 3,
};

describe('StoredEventOutboxEmailFactory', () => {
  it('renders exclusively from the claimed immutable payload', () => {
    const email = new StoredEventOutboxEmailFactory(
      'https://alice.example'
    ).build(item);

    expect(email.text).toContain('Snapshot actor changed "Snapshot title"');
    expect(email.text).toContain('from To do to Done');
    expect(email.text).toContain('/work-items/work-item-1');
  });

  it('renders a weekly report from its stored aggregate snapshot', () => {
    const email = new StoredEventOutboxEmailFactory(
      'https://alice.example'
    ).build({
      ...item,
      template: EmailTemplate.weekly_project_report,
      payload: {
        recipientName: 'Taylor',
        projectId: 'project-1',
        projectName: 'Apollo',
        weekLabel: '2026-11-09 to 2026-11-15',
        completedThisWeekCount: 3,
        createdCount: 5,
        overdueCount: 1,
        pendingCount: 7,
        progressPercent: 30,
        statusSummary: { Done: 3, ToDo: 7 },
        periodStart: '2026-11-09',
        periodEnd: '2026-11-15',
        totalCount: 10,
        completedCount: 3,
      },
    });

    expect(email.text).toContain('3 completed, 5 created, and 1 overdue');
    expect(email.text).toContain('7 pending; overall progress is 30%');
    expect(email.text).toContain('Done: 3, ToDo: 7');
  });

  it('rejects incomplete or extra snapshot fields instead of reconstructing them', () => {
    const factory = new StoredEventOutboxEmailFactory('https://alice.example');
    expect(() => factory.build({ ...item, payload: {} })).toThrow();
    expect(() =>
      factory.build({
        ...item,
        payload: {
          ...(item.payload as object),
          currentWorkItemTitle: 'Live title',
        },
      })
    ).toThrow();
  });
});
