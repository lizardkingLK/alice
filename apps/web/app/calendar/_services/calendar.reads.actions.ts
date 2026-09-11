'use server';

import { WorkItemStatusEnum } from '@repo/types';
import {
  getWorkItems,
  getWorkItemsPaginated,
  type DbWorkItem,
  type GetWorkItemsPaginatedResponse,
  type WorkItemListFilters,
} from '@/app/work-items/_services/work-items.reads.server';
import { getDbUser } from '@/lib/auth';
import { listAccessibleProjectIds } from '@/lib/projects/project-workspace-access';
import { ALL_OPTION } from '@/app/_shared/values';

const FILTER_ALL = 'all';

export type CalendarListFilterInput = {
  readonly projectId?: string;
  readonly sprintId?: string;
  readonly assigneeId?: string;
  readonly type?: string;
  readonly accessibleProjectIds?: readonly string[];
};

function resolveListFilters(
  input: CalendarListFilterInput,
  accessibleIds: readonly string[]
): WorkItemListFilters | null {
  if (accessibleIds.length === 0) {
    return null;
  }

  const filters: WorkItemListFilters = {
    excludeStatuses: [WorkItemStatusEnum.Draft],
    recordStatus: 'active',
  };

  const projectId = input.projectId?.trim();
  if (
    projectId &&
    projectId !== FILTER_ALL &&
    accessibleIds.includes(projectId)
  ) {
    filters.projectId = projectId;
  } else {
    filters.projectIds = [...accessibleIds];
  }

  const sprintId = input.sprintId?.trim();
  if (sprintId && sprintId !== FILTER_ALL) {
    filters.sprintId = sprintId;
  }

  const assigneeId = input.assigneeId?.trim();
  if (assigneeId && assigneeId !== ALL_OPTION && assigneeId !== FILTER_ALL) {
    filters.assigneeId = assigneeId;
  }

  const type = input.type?.trim();
  if (type && type !== ALL_OPTION && type !== FILTER_ALL) {
    filters.type = type as WorkItemListFilters['type'];
  }

  return filters;
}

async function resolveAccessibleIds(
  preferred?: readonly string[]
): Promise<string[]> {
  if (preferred && preferred.length > 0) {
    return [...preferred];
  }
  const dbUser = await getDbUser();
  if (!dbUser) {
    return [];
  }
  return listAccessibleProjectIds(dbUser.id);
}

/**
 * Due-dated work items for the visible calendar grid (inclusive YYYY-MM-DD range).
 */
export async function fetchCalendarScheduledWorkItems(input: {
  readonly from: string;
  readonly to: string;
  readonly filters: CalendarListFilterInput;
}): Promise<DbWorkItem[]> {
  const accessibleIds = await resolveAccessibleIds(
    input.filters.accessibleProjectIds
  );
  const base = resolveListFilters(input.filters, accessibleIds);
  if (!base) {
    return [];
  }

  return getWorkItems(
    {
      ...base,
      dueDate: { from: input.from, to: input.to },
    },
    { includeDescription: true }
  );
}

/**
 * All unscheduled (due_date IS NULL) work items for the calendar side panel cache.
 * Panel paginates and searches this list in memory; use refresh to reload.
 */
export async function fetchCalendarUnscheduledWorkItems(input: {
  readonly filters: CalendarListFilterInput;
}): Promise<DbWorkItem[]> {
  const accessibleIds = await resolveAccessibleIds(
    input.filters.accessibleProjectIds
  );
  const base = resolveListFilters(input.filters, accessibleIds);
  if (!base) {
    return [];
  }

  return getWorkItems(
    {
      ...base,
      dueDate: 'null',
    },
    { includeDescription: true }
  );
}

/**
 * Paginated unscheduled (due_date IS NULL) work items for the calendar side panel.
 */
export async function fetchCalendarUnscheduledWorkItemsPaginated(input: {
  readonly page: number;
  readonly limit: number;
  readonly search?: string;
  readonly filters: CalendarListFilterInput;
}): Promise<GetWorkItemsPaginatedResponse> {
  const accessibleIds = await resolveAccessibleIds(
    input.filters.accessibleProjectIds
  );
  const base = resolveListFilters(input.filters, accessibleIds);
  if (!base) {
    return {
      workItems: [],
      totalCount: 0,
      page: input.page,
      limit: input.limit,
      totalPages: 1,
    };
  }

  return getWorkItemsPaginated(input.page, input.limit, input.search, {
    ...base,
    dueDate: 'null',
  });
}
