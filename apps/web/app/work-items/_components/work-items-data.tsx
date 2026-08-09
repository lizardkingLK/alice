import WorkItemsWorkspace from '@/app/work-items/_components/workItems-workspace';
import {
  getWorkItemsPaginated,
  type DbWorkItem,
} from '@/app/work-items/_services/workItem.service.server';
import { needsWorkspaceProjectBootstrap } from '@/app/board/_helpers/workspace-defaults-shared';
import {
  EMPTY_ACTIVE_SPRINTS_PAGE,
  getSuggestedBoardDefaults,
} from '@/app/board/_services/board-defaults.server';
import { getUserList } from '@/app/users/_services/users.service.server';
import { getProjectList } from '@/app/projects/_services/projects.service.server';
import { getSprintsPaginatedServer } from '@/app/sprints/_services/sprints.service.server';
import { getDbUser } from '@/lib/auth';
import { filterActiveProjects } from '@/lib/projects/active-projects';
import { safeServerFetch } from '@/lib/safe-server-fetch';
import { readWorkItemTableColumnVisibilityBootstrap } from '@/app/work-items/_helpers/work-item-table-columns-cookie.server';
import {
  parseStandardParams,
  parseWorkItemFilters,
  parseWorkItemListView,
  workItemHierarchyListFilter,
  type RawSearchParams,
} from '@/lib/search-params';

const EMPTY_WORK_ITEMS = {
  workItems: [] as DbWorkItem[],
  totalCount: 0,
  page: 1,
  limit: 10,
  totalPages: 1,
};

type WorkItemsDataProps = {
  readonly searchParams: Promise<RawSearchParams>;
  /** Force assignee filter (e.g. My Work /member). */
  readonly lockedAssigneeId?: string;
  /** Force project filter when embedded in a project workspace. */
  readonly lockedProjectId?: string;
  readonly currentUserId?: string | null;
};

export async function WorkItemsData({
  searchParams,
  lockedAssigneeId,
  lockedProjectId,
  currentUserId,
}: Readonly<WorkItemsDataProps>) {
  const resolvedSearchParams = await searchParams;
  const { page, limit, search } = parseStandardParams(resolvedSearchParams, 10);
  const filters = parseWorkItemFilters(resolvedSearchParams);
  const listView = parseWorkItemListView(resolvedSearchParams.view);
  const projectId = lockedProjectId ?? filters.projectId;
  const assigneeId = lockedAssigneeId ?? filters.assigneeId;
  const { type, sprintId, labels } = filters;
  const dbUser = await getDbUser();
  const resolvedUserId = currentUserId ?? dbUser?.id ?? null;
  const isProjectLocked = Boolean(lockedProjectId);
  const isAssigneeLocked = Boolean(lockedAssigneeId);
  const needsClientBootstrap =
    !isProjectLocked &&
    !isAssigneeLocked &&
    needsWorkspaceProjectBootstrap(resolvedSearchParams.project);

  const [columnVisibilityBootstrap, projects, projectMembers, sprintsResult] =
    await Promise.all([
      readWorkItemTableColumnVisibilityBootstrap(),
      safeServerFetch(getProjectList(), [], 'fetch projects for work items'),
      safeServerFetch(getUserList(), [], 'fetch users for work items'),
      safeServerFetch(
        getSprintsPaginatedServer('active', 1, 100),
        EMPTY_ACTIVE_SPRINTS_PAGE,
        'fetch sprints for work items'
      ),
    ]);

  const activeProjects = filterActiveProjects(projects);
  const sprints = sprintsResult.sprints;
  const suggestedDefaults =
    !isProjectLocked && !isAssigneeLocked && dbUser
      ? await getSuggestedBoardDefaults(dbUser, activeProjects, sprints)
      : null;

  // Always fetch: missing projectId means "All projects", not an empty list.
  // needsClientBootstrap only drives client-side URL seeding from localStorage.
  // Hierarchy mode lists roots only; children load on expand.
  const workItemsResult = await safeServerFetch(
    getWorkItemsPaginated(page, limit, search, {
      projectId,
      type,
      assigneeId,
      sprintId,
      labels,
      ...workItemHierarchyListFilter(listView),
    }),
    EMPTY_WORK_ITEMS,
    'fetch work items list'
  );

  return (
    <WorkItemsWorkspace
      projects={isProjectLocked ? projects : activeProjects}
      projectMembers={projectMembers}
      sprints={sprints}
      initialWorkItems={workItemsResult.workItems}
      totalCount={workItemsResult.totalCount}
      page={workItemsResult.page}
      limit={workItemsResult.limit}
      totalPages={workItemsResult.totalPages}
      search={search}
      projectFilter={projectId ?? ''}
      sprintFilter={sprintId ?? ''}
      typeFilter={type ?? ''}
      assigneeFilter={assigneeId ?? ''}
      labelsFilter={labels ?? []}
      listView={listView}
      lockedProjectId={lockedProjectId}
      lockedAssigneeId={lockedAssigneeId}
      currentUserId={resolvedUserId}
      suggestedDefaults={suggestedDefaults}
      needsClientBootstrap={needsClientBootstrap}
      initialColumnVisibility={columnVisibilityBootstrap.visibility}
      columnVisibilityHasCookie={columnVisibilityBootstrap.hasCookie}
    />
  );
}
