import { describe, expect, it } from 'vitest';
import { parseNotificationEmailEvent } from '../../src/routes/api/notifications/notification-email-events';

describe('parseNotificationEmailEvent', () => {
  it.each([
    {
      version: 1,
      template: 'work_item_assignment',
      payload: {
        actorName: 'Alex',
        workItemId: 'work-item',
        workItemTitle: 'Fix notifications',
      },
    },
    {
      version: 1,
      template: 'work_item_reassignment',
      payload: {
        actorName: 'Alex',
        workItemId: 'work-item',
        workItemTitle: 'Fix notifications',
        newAssigneeName: 'Taylor',
      },
    },
    {
      version: 1,
      template: 'work_item_status_change',
      payload: {
        actorName: 'Alex',
        workItemId: 'work-item',
        workItemTitle: 'Fix notifications',
        previousStatus: 'ToDo',
        nextStatus: 'InProgress',
      },
    },
  ])('accepts a supported version/template event', (event) => {
    expect(parseNotificationEmailEvent(event)).toEqual(event);
  });

  it.each([
    {
      version: 2,
      template: 'work_item_assignment',
      payload: {
        actorName: 'Alex',
        workItemId: 'work-item',
        workItemTitle: 'Fix notifications',
      },
    },
    {
      version: 1,
      template: 'weekly_project_report',
      payload: {},
    },
    {
      version: 1,
      template: 'work_item_status_change',
      payload: {
        actorName: 'Alex',
        workItemId: 'work-item',
        workItemTitle: 'Fix notifications',
        previousStatus: 'ToDo',
      },
    },
  ])('rejects unsupported or incomplete events', (event) => {
    expect(() => parseNotificationEmailEvent(event)).toThrow();
  });
});
