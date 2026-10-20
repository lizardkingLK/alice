import { WorkItemStatusEnum } from '@repo/types';
import { getAccessibleProjectList } from '@/lib/projects/accessible-project-list';
import { filterActiveProjects } from '@/lib/projects/active-projects';
import { getWorkItemsPaginated } from '@/app/work-items/_services/work-items.reads.server';
import type { GetWorkItemsPaginatedResponse } from '@/app/work-items/_types/work-items.reads.types';
import { getDocsIndex } from '@/app/docs/_lib/docs';
import { safeServerFetch } from '@/lib/safe-server-fetch';
import type {
  MyWorkOverviewStats,
  ProductivityDashboardBootstrap,
} from '@/app/dashboard/_types/productivity-dashboard.types';

export type {
  MyWorkOverviewStats,
  ProductivityDashboardBootstrap,
  ProductivityProjectSummary,
} from '@/app/dashboard/_types/productivity-dashboard.types';

const OPEN_EXCLUDES = [
  WorkItemStatusEnum.Done,
  WorkItemStatusEnum.Draft,
] as const;

/** Leave only InProgress by excluding every other status. */
const IN_PROGRESS_ONLY_EXCLUDES = [
  WorkItemStatusEnum.Draft,
  WorkItemStatusEnum.New,
  WorkItemStatusEnum.ToDo,
  WorkItemStatusEnum.Testing,
  WorkItemStatusEnum.Done,
] as const;

const EMPTY_COUNT_PAGE: GetWorkItemsPaginatedResponse = {
  workItems: [],
  totalCount: 0,
  page: 1,
  limit: 1,
  totalPages: 0,
};

async function countAssigned(
  userId: string,
  filters: Parameters<typeof getWorkItemsPaginated>[3]
): Promise<number> {
  const result = await safeServerFetch(
    getWorkItemsPaginated(1, 1, undefined, {
      assigneeId: userId,
      recordStatus: 'active',
      ...filters,
    }),
    EMPTY_COUNT_PAGE,
    'count my-work overview stats'
  );
  return result.totalCount;
}

export async function getMyWorkOverviewStats(
  userId: string
): Promise<MyWorkOverviewStats> {
  const [assignedOpen, pendingStories, inProgress] = await Promise.all([
    countAssigned(userId, { excludeStatuses: OPEN_EXCLUDES }),
    countAssigned(userId, {
      type: 'Story',
      excludeStatuses: OPEN_EXCLUDES,
    }),
    countAssigned(userId, {
      excludeStatuses: IN_PROGRESS_ONLY_EXCLUDES,
    }),
  ]);

  return { assignedOpen, pendingStories, inProgress };
}

export type GetProductivityDashboardBootstrapOptions = {
  /**
   * When the overview loader already fetched accessible projects, pass them
   * here to avoid a second `getAccessibleProjectList` round trip.
   */
  readonly projects?: Awaited<ReturnType<typeof getAccessibleProjectList>>;
};

export async function getProductivityDashboardBootstrap(
  userId: string,
  options?: GetProductivityDashboardBootstrapOptions
): Promise<ProductivityDashboardBootstrap> {
  const [myWork, projects, docsIndex] = await Promise.all([
    getMyWorkOverviewStats(userId),
    options?.projects
      ? Promise.resolve(options.projects)
      : safeServerFetch(
          getAccessibleProjectList(userId),
          [],
          'fetch projects for productivity dashboard'
        ),
    safeServerFetch(
      getDocsIndex(),
      [],
      'fetch docs for productivity dashboard'
    ),
  ]);

  const active = filterActiveProjects(projects);
  const docs = docsIndex.filter((entry) => entry.audience === 'user-guide');

  return {
    myWork,
    projects: active.map((project) => ({
      id: project.id,
      name: project.name,
      key: project.key ?? null,
    })),
    docs,
  };
}
