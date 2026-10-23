import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sprintEstimationInputSchema } from '@repo/types';

const {
  sprintFindUniqueMock,
  sprintFindManyMock,
  workItemFindManyMock,
  workItemGroupByMock,
} = vi.hoisted(() => ({
  sprintFindUniqueMock: vi.fn(),
  sprintFindManyMock: vi.fn(),
  workItemFindManyMock: vi.fn(),
  workItemGroupByMock: vi.fn(),
}));

vi.mock('../../src/lib/prisma', () => ({
  prisma: {
    sprints: {
      findUnique: sprintFindUniqueMock,
      findMany: sprintFindManyMock,
    },
    work_items: {
      findMany: workItemFindManyMock,
      groupBy: workItemGroupByMock,
    },
  },
}));

import {
  PREVIOUS_SPRINT_COMPLETION_BASIS,
  SPRINT_ESTIMATION_HISTORY_LIMIT,
  SPRINT_ESTIMATION_PREVIOUS_SPRINT_LIMIT,
  SPRINT_ESTIMATION_TARGET_LIMIT,
  SprintEstimationRepository,
} from '../../src/routes/api/sprints/sprint-estimation.repository';

const SPRINT_ID = '11111111-1111-4111-8111-111111111111';
const PROJECT_ID = '22222222-2222-4222-8222-222222222222';
const OTHER_PROJECT_ID = '99999999-9999-4999-8999-999999999999';
const TARGET_ID = '33333333-3333-4333-8333-333333333333';
const HISTORY_ID = '44444444-4444-4444-8444-444444444444';
const ASSIGNEE_ID = '55555555-5555-4555-8555-555555555555';
const PREVIOUS_SPRINT_ID = '66666666-6666-4666-8666-666666666666';
const OLDER_SPRINT_ID = '77777777-7777-4777-8777-777777777777';
const SPRINT_START = new Date('2026-10-01T00:00:00.000Z');

function targetRow(overrides: Record<string, unknown> = {}) {
  return {
    id: TARGET_ID,
    project_id: PROJECT_ID,
    type: 'Task',
    priority: 'high',
    description: {
      type: 'doc',
      attrs: { dynamicFields: { severity: 'Critical' } },
      content: [],
    },
    story_points: 5,
    assignee_id: ASSIGNEE_ID,
    assignee: {
      team_memberships: [{ seniority: ' Senior ' }],
    },
    ...overrides,
  };
}

function historyRow(overrides: Record<string, unknown> = {}) {
  return {
    id: HISTORY_ID,
    project_id: PROJECT_ID,
    type: 'Task',
    priority: 'high',
    description: {
      type: 'doc',
      attrs: { dynamicFields: { severity: 'Major' } },
      content: [],
    },
    story_points: 3,
    assignee_id: ASSIGNEE_ID,
    assignee: {
      team_memberships: [{ seniority: 'Senior' }],
    },
    worklogs: [{ logged_hours: 1.5 }, { logged_hours: 2.5 }],
    ...overrides,
  };
}

function mockSprint() {
  sprintFindUniqueMock.mockResolvedValue({
    id: SPRINT_ID,
    project_id: PROJECT_ID,
    start_date: SPRINT_START,
  });
}

describe('SprintEstimationRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('maps completed project history, assignee experience, and approximate sprint completion', async () => {
    mockSprint();
    workItemFindManyMock
      .mockResolvedValueOnce([targetRow()])
      .mockResolvedValueOnce([historyRow()]);
    sprintFindManyMock.mockResolvedValue([
      { id: PREVIOUS_SPRINT_ID },
      { id: OLDER_SPRINT_ID },
    ]);
    workItemGroupByMock.mockResolvedValue([
      {
        sprint_id: PREVIOUS_SPRINT_ID,
        status_category: 'done',
        _sum: { story_points: 8 },
      },
      {
        sprint_id: PREVIOUS_SPRINT_ID,
        status_category: 'in_progress',
        _sum: { story_points: 2 },
      },
      {
        sprint_id: OLDER_SPRINT_ID,
        status_category: 'done',
        _sum: { story_points: 5 },
      },
      {
        sprint_id: OLDER_SPRINT_ID,
        status_category: 'todo',
        _sum: { story_points: 5 },
      },
    ]);

    const result = await new SprintEstimationRepository().loadForSprint(
      SPRINT_ID
    );

    expect(result).toEqual({
      sprintId: SPRINT_ID,
      projectId: PROJECT_ID,
      previousSprintCompletionBasis: PREVIOUS_SPRINT_COMPLETION_BASIS,
      estimationInputs: [
        {
          workItem: {
            id: TARGET_ID,
            projectId: PROJECT_ID,
            type: 'Task',
            priority: 'high',
            severity: 'Critical',
            storyPoints: 5,
            assigneeId: ASSIGNEE_ID,
            assigneeSeniority: 'Senior',
          },
          history: [
            {
              projectId: PROJECT_ID,
              type: 'Task',
              priority: 'high',
              severity: 'Major',
              storyPoints: 3,
              assigneeId: ASSIGNEE_ID,
              assigneeSeniority: 'Senior',
              loggedHours: 4,
              completed: true,
            },
          ],
          previousSprintCompletions: [
            { committedStoryPoints: 10, completedStoryPoints: 8 },
            { committedStoryPoints: 10, completedStoryPoints: 5 },
          ],
        },
      ],
    });
    expect(
      sprintEstimationInputSchema.safeParse(result?.estimationInputs[0]).success
    ).toBe(true);
  });

  it('filters invalid hours and cross-project rows while handling missing optional data', async () => {
    mockSprint();
    workItemFindManyMock
      .mockResolvedValueOnce([
        targetRow({
          description: null,
          story_points: null,
          assignee_id: null,
          assignee: null,
        }),
        targetRow({
          id: '88888888-8888-4888-8888-888888888888',
          project_id: OTHER_PROJECT_ID,
        }),
      ])
      .mockResolvedValueOnce([
        historyRow({
          description: {
            type: 'doc',
            content: [
              {
                type: 'paragraph',
                content: [
                  {
                    type: 'text',
                    text: '[Dynamic Fields]\nseverity: Blocker',
                  },
                ],
              },
            ],
          },
          story_points: null,
          assignee_id: null,
          assignee: null,
          worklogs: [
            { logged_hours: 0 },
            { logged_hours: -2 },
            { logged_hours: Number.NaN },
            { logged_hours: Number.POSITIVE_INFINITY },
            { logged_hours: 1.25 },
            { logged_hours: 2.75 },
          ],
        }),
        historyRow({
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          worklogs: [{ logged_hours: 0 }, { logged_hours: -1 }],
        }),
        historyRow({
          id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          project_id: OTHER_PROJECT_ID,
          worklogs: [{ logged_hours: 50 }],
        }),
      ]);
    sprintFindManyMock.mockResolvedValue([]);

    const result = await new SprintEstimationRepository().loadForSprint(
      SPRINT_ID
    );

    expect(result?.estimationInputs).toHaveLength(1);
    expect(result?.estimationInputs[0]).toMatchObject({
      workItem: {
        severity: null,
        storyPoints: null,
        assigneeId: null,
        assigneeSeniority: null,
      },
      history: [
        {
          severity: 'Blocker',
          storyPoints: null,
          assigneeId: null,
          assigneeSeniority: null,
          loggedHours: 4,
        },
      ],
      previousSprintCompletions: [],
    });
    expect(workItemGroupByMock).not.toHaveBeenCalled();
  });

  it('returns an empty, valid history set and null for a missing sprint', async () => {
    mockSprint();
    workItemFindManyMock
      .mockResolvedValueOnce([targetRow()])
      .mockResolvedValueOnce([]);
    sprintFindManyMock.mockResolvedValue([]);

    const repository = new SprintEstimationRepository();
    const result = await repository.loadForSprint(SPRINT_ID);

    expect(result?.estimationInputs[0]).toMatchObject({
      history: [],
      previousSprintCompletions: [],
    });
    expect(workItemGroupByMock).not.toHaveBeenCalled();

    sprintFindUniqueMock.mockResolvedValueOnce(null);
    await expect(repository.loadForSprint(SPRINT_ID)).resolves.toBeNull();
  });

  it('uses bounded, predictable, project-scoped Prisma queries without N+1 reads', async () => {
    mockSprint();
    workItemFindManyMock
      .mockResolvedValueOnce([targetRow()])
      .mockResolvedValueOnce([historyRow()]);
    sprintFindManyMock.mockResolvedValue([{ id: PREVIOUS_SPRINT_ID }]);
    workItemGroupByMock.mockResolvedValue([]);

    await new SprintEstimationRepository().loadForSprint(SPRINT_ID);

    expect(sprintFindUniqueMock).toHaveBeenCalledWith({
      where: { id: SPRINT_ID },
      select: { id: true, project_id: true, start_date: true },
    });
    expect(workItemFindManyMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: {
          sprint_id: SPRINT_ID,
          project_id: PROJECT_ID,
          record_status: 'active',
        },
        orderBy: { id: 'asc' },
        take: SPRINT_ESTIMATION_TARGET_LIMIT,
      })
    );
    expect(workItemFindManyMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: {
          project_id: PROJECT_ID,
          record_status: 'active',
          status_category: 'done',
          done_at: { lt: SPRINT_START },
          worklogs: {
            some: { status: 'active', logged_hours: { gt: 0 } },
          },
        },
        orderBy: [{ done_at: 'desc' }, { id: 'asc' }],
        take: SPRINT_ESTIMATION_HISTORY_LIMIT,
      })
    );
    expect(sprintFindManyMock).toHaveBeenCalledWith({
      where: {
        project_id: PROJECT_ID,
        id: { not: SPRINT_ID },
        status: { in: ['closed', 'archived'] },
        end_date: { lt: SPRINT_START },
      },
      select: { id: true },
      orderBy: [{ end_date: 'desc' }, { id: 'asc' }],
      take: SPRINT_ESTIMATION_PREVIOUS_SPRINT_LIMIT,
    });
    expect(workItemGroupByMock).toHaveBeenCalledWith({
      by: ['sprint_id', 'status_category'],
      where: {
        project_id: PROJECT_ID,
        sprint_id: { in: [PREVIOUS_SPRINT_ID] },
        record_status: 'active',
        story_points: { gt: 0 },
      },
      _sum: { story_points: true },
      orderBy: [{ sprint_id: 'asc' }, { status_category: 'asc' }],
    });
    expect(workItemFindManyMock).toHaveBeenCalledTimes(2);
    expect(sprintFindManyMock).toHaveBeenCalledTimes(1);
    expect(workItemGroupByMock).toHaveBeenCalledTimes(1);
  });
});
