import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChartsService } from '../../src/routes/api/charts/charts.service';
import type { ChartsRepository } from '../../src/routes/api/charts/charts.repository';
import type { NotificationsRepository } from '../../src/routes/api/notifications/notifications.repository';

const {
  listAccessibleProjectIdsMock,
  getSprintForContributionMock,
  listSprintContributionItemsMock,
  listSprintContributionWorklogsMock,
  listSprintContributionRollupMock,
  listUserDisplayNamesMock,
  rebuildSprintAnalyticsRollupMock,
} = vi.hoisted(() => ({
  listAccessibleProjectIdsMock: vi.fn(),
  getSprintForContributionMock: vi.fn(),
  listSprintContributionItemsMock: vi.fn(),
  listSprintContributionWorklogsMock: vi.fn(),
  listSprintContributionRollupMock: vi.fn(),
  listUserDisplayNamesMock: vi.fn(),
  rebuildSprintAnalyticsRollupMock: vi.fn(),
}));

const chartsRepository = {
  listAccessibleProjectIds: listAccessibleProjectIdsMock,
  getSprintForContribution: getSprintForContributionMock,
  listSprintContributionItems: listSprintContributionItemsMock,
  listSprintContributionWorklogs: listSprintContributionWorklogsMock,
  listSprintContributionRollup: listSprintContributionRollupMock,
  listUserDisplayNames: listUserDisplayNamesMock,
  rebuildSprintAnalyticsRollup: rebuildSprintAnalyticsRollupMock,
} as unknown as ChartsRepository;

const service = new ChartsService(
  chartsRepository,
  {} as NotificationsRepository
);

const PROJECT_ID = '33333333-3333-4333-8333-333333333333';
const SPRINT_ID = '55555555-5555-4555-8555-555555555555';
const USER_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const USER_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

describe('ChartsService getSprintContribution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listAccessibleProjectIdsMock.mockResolvedValue([PROJECT_ID]);
    getSprintForContributionMock.mockResolvedValue({
      id: SPRINT_ID,
      project_id: PROJECT_ID,
      name: 'Sprint 12',
      start_date: '2026-01-10',
      end_date: '2026-01-20',
      status: 'active',
    });
    listSprintContributionRollupMock.mockResolvedValue([]);
    rebuildSprintAnalyticsRollupMock.mockResolvedValue(undefined);
    listSprintContributionItemsMock.mockResolvedValue([
      {
        id: 'wi-1',
        assignee_id: USER_A,
        story_points: 10,
        status_category: 'in_progress',
      },
      {
        id: 'wi-2',
        assignee_id: USER_B,
        story_points: 8,
        status_category: 'done',
      },
      {
        id: 'wi-3',
        assignee_id: null,
        story_points: 5,
        status_category: 'todo',
      },
    ]);
    listSprintContributionWorklogsMock.mockResolvedValue([
      {
        work_item_id: 'wi-1',
        logged_at: '2026-01-12T12:00:00.000Z',
        logged_hours: 1,
      },
      {
        work_item_id: 'wi-2',
        logged_at: '2026-01-12T12:00:00.000Z',
        logged_hours: 8,
      },
    ]);
    listUserDisplayNamesMock.mockResolvedValue({
      [USER_A]: 'Ada',
      [USER_B]: 'Bob',
    });
  });

  it('uses live compute and best-effort rebuild when rollup misses', async () => {
    const result = await service.getSprintContribution('user-1', {
      projectId: PROJECT_ID,
      sprintId: SPRINT_ID,
      asOf: '2026-01-15',
    });

    expect(listAccessibleProjectIdsMock).toHaveBeenCalledWith('user-1');
    expect(listSprintContributionItemsMock).toHaveBeenCalledWith(SPRINT_ID);
    expect(rebuildSprintAnalyticsRollupMock).toHaveBeenCalledWith(SPRINT_ID);
    expect(result.sprintName).toBe('Sprint 12');
    expect(result.asOf).toBe('2026-01-15');
    expect(result.groups.map((group) => group.id)).toEqual([
      'active',
      'unassigned',
      'done',
    ]);
    expect(result.groups.find((group) => group.id === 'active')?.rows).toEqual([
      expect.objectContaining({
        assigneeId: USER_A,
        assigneeName: 'Ada',
        behind: true,
        estimatedPoints: 10,
        loggedHours: 1,
      }),
    ]);
    expect(result.groups.find((group) => group.id === 'done')?.rows).toEqual([
      expect.objectContaining({
        assigneeId: USER_B,
        assigneeName: 'Bob',
        behind: false,
        estimatedPoints: 8,
        loggedHours: 8,
      }),
    ]);
    expect(
      result.groups.find((group) => group.id === 'unassigned')?.rows
    ).toEqual([
      expect.objectContaining({
        assigneeId: null,
        estimatedPoints: 5,
        behind: false,
      }),
    ]);
  });

  it('prefers matching rollup rows and skips live item/worklog reads', async () => {
    listSprintContributionRollupMock.mockResolvedValue([
      {
        assignee_id: USER_A,
        group_id: 'active',
        estimated_points: 10,
        logged_hours: 1,
        item_count: 1,
        as_of: '2026-01-15',
      },
      {
        assignee_id: USER_B,
        group_id: 'done',
        estimated_points: 8,
        logged_hours: 8,
        item_count: 1,
        as_of: '2026-01-15',
      },
      {
        assignee_id: null,
        group_id: 'unassigned',
        estimated_points: 5,
        logged_hours: 0,
        item_count: 1,
        as_of: '2026-01-15',
      },
    ]);

    const result = await service.getSprintContribution('user-1', {
      projectId: PROJECT_ID,
      sprintId: SPRINT_ID,
      asOf: '2026-01-15',
    });

    expect(listSprintContributionItemsMock).not.toHaveBeenCalled();
    expect(listSprintContributionWorklogsMock).not.toHaveBeenCalled();
    expect(rebuildSprintAnalyticsRollupMock).not.toHaveBeenCalled();
    expect(result.groups.find((group) => group.id === 'active')?.rows).toEqual([
      expect.objectContaining({
        assigneeId: USER_A,
        assigneeName: 'Ada',
        behind: true,
        loggedHours: 1,
      }),
    ]);
  });

  it('falls back to live when rollup as_of does not match request', async () => {
    listSprintContributionRollupMock.mockResolvedValue([
      {
        assignee_id: USER_A,
        group_id: 'active',
        estimated_points: 10,
        logged_hours: 1,
        item_count: 1,
        as_of: '2026-01-14',
      },
    ]);

    await service.getSprintContribution('user-1', {
      projectId: PROJECT_ID,
      sprintId: SPRINT_ID,
      asOf: '2026-01-15',
    });

    expect(listSprintContributionItemsMock).toHaveBeenCalled();
    expect(rebuildSprintAnalyticsRollupMock).toHaveBeenCalledWith(SPRINT_ID);
  });

  it('forbids contribution when project is not accessible', async () => {
    listAccessibleProjectIdsMock.mockResolvedValue([]);

    await expect(
      service.getSprintContribution('user-1', {
        projectId: PROJECT_ID,
        sprintId: SPRINT_ID,
      })
    ).rejects.toThrow('Forbidden');
    expect(getSprintForContributionMock).not.toHaveBeenCalled();
  });

  it('rejects when sprint belongs to another project', async () => {
    getSprintForContributionMock.mockResolvedValue({
      id: SPRINT_ID,
      project_id: '99999999-9999-4999-8999-999999999999',
      name: 'Other',
      start_date: '2026-01-10',
      end_date: '2026-01-20',
      status: 'active',
    });

    await expect(
      service.getSprintContribution('user-1', {
        projectId: PROJECT_ID,
        sprintId: SPRINT_ID,
      })
    ).rejects.toThrow('Sprint not found');
  });

  it('filters to a single assignee when assigneeId is set', async () => {
    const result = await service.getSprintContribution('user-1', {
      projectId: PROJECT_ID,
      sprintId: SPRINT_ID,
      assigneeId: USER_A,
      asOf: '2026-01-15',
    });

    expect(result.assigneeId).toBe(USER_A);
    expect(
      result.groups.find((group) => group.id === 'active')?.rows
    ).toHaveLength(1);
    expect(
      result.groups.find((group) => group.id === 'unassigned')?.rows
    ).toHaveLength(0);
    expect(
      result.groups.find((group) => group.id === 'done')?.rows
    ).toHaveLength(0);
  });
});
