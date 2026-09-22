import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkItemStatusEnum } from '@repo/types';

const getWorkItemsMock = vi.hoisted(() => vi.fn());
const getWorkItemsPaginatedMock = vi.hoisted(() => vi.fn());

vi.mock('@/app/work-items/_services/work-items.reads.server', () => ({
  getWorkItems: getWorkItemsMock,
  getWorkItemsPaginated: getWorkItemsPaginatedMock,
}));

import {
  fetchCalendarScheduledWorkItems,
  fetchCalendarUnscheduledWorkItems,
  fetchCalendarUnscheduledWorkItemsPaginated,
} from '@/app/calendar/_services/calendar.reads.actions';

const filters = {
  accessibleProjectIds: ['project-1'],
};

describe('calendar read actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getWorkItemsMock.mockResolvedValue([]);
    getWorkItemsPaginatedMock.mockResolvedValue({
      workItems: [],
      totalCount: 0,
      page: 1,
      limit: 5,
      totalPages: 1,
    });
  });

  it('loads scheduled items while excluding only Draft', async () => {
    await fetchCalendarScheduledWorkItems({
      from: '2026-09-01',
      to: '2026-10-12',
      filters,
    });

    expect(getWorkItemsMock).toHaveBeenCalledWith(
      {
        projectIds: ['project-1'],
        recordStatus: 'active',
        dueDate: { from: '2026-09-01', to: '2026-10-12' },
        excludeStatuses: [WorkItemStatusEnum.Draft],
      },
      { includeDescription: true }
    );
  });

  it('loads unscheduled items with no due date and excludes Draft and Done', async () => {
    await fetchCalendarUnscheduledWorkItems({ filters });

    expect(getWorkItemsMock).toHaveBeenCalledWith(
      {
        projectIds: ['project-1'],
        recordStatus: 'active',
        dueDate: 'null',
        excludeStatuses: [WorkItemStatusEnum.Draft, WorkItemStatusEnum.Done],
      },
      { includeDescription: true }
    );
  });

  it('applies the same exclusions to paginated unscheduled items', async () => {
    await fetchCalendarUnscheduledWorkItemsPaginated({
      page: 1,
      limit: 5,
      search: 'calendar',
      filters,
    });

    expect(getWorkItemsPaginatedMock).toHaveBeenCalledWith(1, 5, 'calendar', {
      projectIds: ['project-1'],
      recordStatus: 'active',
      dueDate: 'null',
      excludeStatuses: [WorkItemStatusEnum.Draft, WorkItemStatusEnum.Done],
    });
  });
});
