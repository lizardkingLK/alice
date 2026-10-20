import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Database } from '@repo/types';
import type { SupabaseClient } from '@supabase/supabase-js';

const { findManyMock, listAccessibleProjectIdsMock } = vi.hoisted(() => ({
  findManyMock: vi.fn(),
  listAccessibleProjectIdsMock: vi.fn(),
}));

vi.mock('../../src/lib/prisma', () => ({
  prisma: { work_items: { findMany: findManyMock } },
}));

vi.mock('../../src/lib/project-access', () => ({
  listAccessibleProjectIds: listAccessibleProjectIdsMock,
}));

import {
  dailyReportWorkItemSelect,
  ReportsRepository,
} from '../../src/routes/api/reports/reports.repository';

const ACTOR_ID = '22222222-2222-4222-8222-222222222222';
const PROJECT_ID = '33333333-3333-4333-8333-333333333333';
const SPRINT_ID = '44444444-4444-4444-8444-444444444444';
const repository = new ReportsRepository({} as SupabaseClient<Database>);

describe('ReportsRepository', () => {
  beforeEach(() => vi.clearAllMocks());

  it('delegates accessible project resolution to the shared ACL helper', async () => {
    listAccessibleProjectIdsMock.mockResolvedValue([PROJECT_ID]);

    await expect(
      repository.listAccessibleProjectIds(ACTOR_ID)
    ).resolves.toEqual([PROJECT_ID]);
    expect(listAccessibleProjectIdsMock).toHaveBeenCalledWith({}, ACTOR_ID);
  });

  it('queries active personal work directly with filters and done_at boundaries', async () => {
    findManyMock.mockResolvedValue([]);
    const start = new Date('2026-10-19T18:30:00.000Z');
    const endExclusive = new Date('2026-10-20T18:30:00.000Z');

    await repository.listDailyReportItems({
      actorId: ACTOR_ID,
      projectIds: [PROJECT_ID],
      sprintIds: [SPRINT_ID],
      start,
      endExclusive,
    });

    expect(findManyMock).toHaveBeenCalledWith({
      where: {
        assignee_id: ACTOR_ID,
        project_id: { in: [PROJECT_ID] },
        sprint_id: { in: [SPRINT_ID] },
        record_status: 'active',
        OR: [
          { status_category: { not: 'done' } },
          { done_at: { gte: start, lt: endExclusive } },
        ],
      },
      select: dailyReportWorkItemSelect,
      orderBy: [{ due_date: 'asc' }, { title: 'asc' }, { id: 'asc' }],
    });
  });

  it('maps the normalized custom workflow category instead of the legacy status', async () => {
    findManyMock.mockResolvedValue([
      {
        id: '11111111-1111-4111-8111-111111111111',
        title: 'Custom QA',
        type: 'Task',
        priority: 'high',
        due_date: new Date('2026-10-20T00:00:00.000Z'),
        story_points: 3,
        status: 'New',
        status_category: 'in_progress',
        state: {
          workflowId: 'custom',
          stateId: 'quality-review',
          category: 'in_progress',
        },
        state_id: 'quality-review',
        board_column_id: 'quality-review',
        state_workflow_id: 'custom',
        labels: ['release'],
        done_at: null,
        project: { id: PROJECT_ID, key: 'AL', name: 'Alice' },
        sprint: { id: SPRINT_ID, name: 'Sprint 1' },
      },
    ]);

    const result = await repository.listDailyReportItems({
      actorId: ACTOR_ID,
      projectIds: [PROJECT_ID],
      start: new Date('2026-10-19T18:30:00.000Z'),
      endExclusive: new Date('2026-10-20T18:30:00.000Z'),
    });

    expect(result[0]).toMatchObject({
      statusCategory: 'in_progress',
      stateId: 'quality-review',
      dueDate: '2026-10-20',
      labels: ['release'],
    });
  });

  it('does not query work items when no projects are accessible', async () => {
    await expect(
      repository.listDailyReportItems({
        actorId: ACTOR_ID,
        projectIds: [],
        start: new Date('2026-10-20T00:00:00.000Z'),
        endExclusive: new Date('2026-10-21T00:00:00.000Z'),
      })
    ).resolves.toEqual([]);
    expect(findManyMock).not.toHaveBeenCalled();
  });
});
