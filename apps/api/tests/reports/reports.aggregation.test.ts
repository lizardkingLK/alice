import { describe, expect, it } from 'vitest';
import {
  buildDailyReportSnapshot,
  type DailyReportSourceItem,
} from '../../src/routes/api/reports/reports.aggregation';

function item(
  overrides: Partial<DailyReportSourceItem> = {}
): DailyReportSourceItem {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    title: 'Prepare release',
    type: 'Task',
    priority: 'medium',
    project: {
      id: '33333333-3333-4333-8333-333333333333',
      key: 'AL',
      name: 'Alice',
    },
    sprint: null,
    dueDate: null,
    storyPoints: 3,
    statusCategory: 'todo',
    stateId: 'ToDo',
    labels: [],
    doneAt: null,
    ...overrides,
  };
}

const context = {
  reportDate: '2026-10-20',
  timezone: 'Asia/Colombo',
  start: new Date('2026-10-19T18:30:00.000Z'),
  endExclusive: new Date('2026-10-20T18:30:00.000Z'),
};

describe('buildDailyReportSnapshot', () => {
  it('aggregates completed, ongoing, pending, blocked, and deadline groups', () => {
    const snapshot = buildDailyReportSnapshot(
      [
        item({
          id: '00000000-0000-4000-8000-000000000001',
          title: 'Completed',
          statusCategory: 'done',
          stateId: 'Released',
          doneAt: '2026-10-20T02:00:00.000Z',
        }),
        item({
          id: '00000000-0000-4000-8000-000000000002',
          title: 'Custom QA state',
          statusCategory: 'in_progress',
          stateId: 'quality-review',
          dueDate: '2026-10-20',
        }),
        item({
          id: '00000000-0000-4000-8000-000000000003',
          title: 'Pending',
          statusCategory: 'draft',
          dueDate: '2026-10-19',
        }),
        item({
          id: '00000000-0000-4000-8000-000000000004',
          title: 'Blocked by dependency',
          statusCategory: 'todo',
          stateId: 'blocked',
          dueDate: '2026-10-24',
        }),
        item({
          id: '00000000-0000-4000-8000-000000000005',
          title: 'Label-blocked',
          statusCategory: 'in_progress',
          labels: ['blocked'],
        }),
      ],
      context
    );

    expect(snapshot.completed.map((entry) => entry.title)).toEqual([
      'Completed',
    ]);
    expect(snapshot.inProgress.map((entry) => entry.title)).toEqual([
      'Custom QA state',
    ]);
    expect(snapshot.pending.map((entry) => entry.title)).toEqual(['Pending']);
    expect(snapshot.blocked.map((entry) => entry.title)).toEqual([
      'Blocked by dependency',
      'Label-blocked',
    ]);
    expect(snapshot.dueToday).toHaveLength(1);
    expect(snapshot.overdue).toHaveLength(1);
    expect(snapshot.upcomingDeadlines).toHaveLength(1);
    expect(snapshot.summary).toEqual({
      completed: 1,
      inProgress: 1,
      pending: 1,
      blocked: 2,
      dueToday: 1,
      overdue: 1,
      upcomingDeadlines: 1,
    });
  });

  it('uses an inclusive start and exclusive end for completion timestamps', () => {
    const snapshot = buildDailyReportSnapshot(
      [
        item({
          id: '00000000-0000-4000-8000-000000000010',
          statusCategory: 'done',
          doneAt: context.start.toISOString(),
        }),
        item({
          id: '00000000-0000-4000-8000-000000000011',
          statusCategory: 'done',
          doneAt: new Date(context.endExclusive.getTime() - 1).toISOString(),
        }),
        item({
          id: '00000000-0000-4000-8000-000000000012',
          statusCategory: 'done',
          doneAt: context.endExclusive.toISOString(),
        }),
      ],
      context
    );

    expect(snapshot.completed.map((entry) => entry.id)).toEqual([
      '00000000-0000-4000-8000-000000000011',
      '00000000-0000-4000-8000-000000000010',
    ]);
  });
});
