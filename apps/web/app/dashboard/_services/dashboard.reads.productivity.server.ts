import { WorkItemStatusEnum } from '@repo/types';
import { getAccessibleProjectList } from '@/lib/projects/accessible-project-list';
import { filterActiveProjects } from '@/lib/projects/active-projects';
import { getWorkItemsPaginated } from '@/app/work-items/_services/work-items.reads.server';
import type { GetWorkItemsPaginatedResponse } from '@/app/work-items/_types/work-items.reads.types';
import { getDocsIndex } from '@/app/docs/_lib/docs';
import { resolveOverviewChatAgentsBootstrap } from '@/app/chat/_services/chat-agents.reads.server';
import { listChatModelsForChat } from '@/app/chat/_services/chat-models.reads.server';
import {
  getAssignedCompletion,
  listAssignedWipItems,
  listUnreadNotifications,
} from '@/app/dashboard/_services/my-work-snapshot.reads.server';
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
  const [
    myWork,
    projects,
    docsIndex,
    wipItems,
    unreadNotifications,
    completion,
    chatModels,
    chatAgentsBootstrap,
  ] = await Promise.all([
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
    safeServerFetch(
      listAssignedWipItems(userId),
      [],
      'fetch WIP for productivity dashboard'
    ),
    safeServerFetch(
      listUnreadNotifications(userId),
      [],
      'fetch notifications for productivity dashboard'
    ),
    safeServerFetch(
      getAssignedCompletion(userId),
      { doneCount: 0, totalCount: 0, percent: 0 },
      'fetch completion for productivity dashboard'
    ),
    safeServerFetch(
      listChatModelsForChat(),
      [],
      'fetch chat models for productivity dashboard'
    ),
    safeServerFetch(
      resolveOverviewChatAgentsBootstrap(),
      { agents: [], preferredAgentId: null },
      'fetch chat agents for productivity dashboard'
    ),
  ]);

  const active = filterActiveProjects(projects);
  const docs = docsIndex.filter((entry) => entry.audience === 'user-guide');
  const hasModels = chatModels.length > 0;

  return {
    myWork,
    projects: active.map((project) => ({
      id: project.id,
      name: project.name,
      key: project.key ?? null,
    })),
    docs,
    wipItems,
    unreadNotifications,
    completion,
    chatModels,
    // Personality chrome only when a model pool exists.
    chatAgents: hasModels ? chatAgentsBootstrap.agents : [],
    preferredChatAgentId: hasModels
      ? chatAgentsBootstrap.preferredAgentId
      : null,
  };
}
