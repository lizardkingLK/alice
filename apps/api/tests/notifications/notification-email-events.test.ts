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
    {
      version: 1,
      template: 'weekly_project_report',
      payload: {
        projectId: 'project-1',
        projectName: 'Apollo',
        weekLabel: '2026-11-09 to 2026-11-15',
        periodStart: '2026-11-09',
        periodEnd: '2026-11-15',
        totalCount: 10,
        completedCount: 4,
        completedThisWeekCount: 2,
        pendingCount: 6,
        createdCount: 3,
        overdueCount: 1,
        progressPercent: 40,
        statusSummary: { Done: 4, ToDo: 6 },
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
