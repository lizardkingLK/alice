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
