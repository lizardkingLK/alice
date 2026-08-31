import WorkItemsWorkspace from '@/app/work-items/_components/work-items-workspace';
import {
  getWorkItemsPaginated,
  type DbWorkItem,
  type WorkItemListFilters,
} from '@/app/work-items/_services/work-items.reads.server';
import { needsWorkspaceProjectBootstrap } from '@/app/board/_helpers/workspace-defaults-shared';
import {
  EMPTY_ACTIVE_SPRINTS_PAGE,
  getSuggestedBoardDefaults,
} from '@/app/board/_services/board.reads.defaults.server';
import { getUserList } from '@/app/users/_services/users.reads.server';
import { getProjectList } from '@/app/projects/_services/projects.reads.server';
import { getSprintsPaginatedServer } from '@/app/sprints/_services/sprints.reads.server';
import { getDbUser } from '@/lib/auth';
import { filterActiveProjects } from '@/lib/projects/active-projects';
import { listAccessibleProjectIds } from '@/lib/projects/project-workspace-access';
import { safeServerFetch } from '@/lib/safe-server-fetch';
import { readWorkItemTableColumnVisibilityBootstrap } from '@/app/work-items/_helpers/work-item-table-columns-cookie.server';
import {
  parseStandardParams,
  parseWorkItemFilters,
  parseWorkItemListView,
  parseWorkItemRecordStatus,
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

function resolveScopedWorkItemFilters(options: {
  readonly accessible: 'all' | string[];
  readonly projectId?: string;
  readonly type: WorkItemListFilters['type'];
  readonly assigneeId?: string;
  readonly sprintId?: string | null;
  readonly labels?: string[];
  readonly hierarchy: ReturnType<typeof workItemHierarchyListFilter>;
  readonly recordStatus: 'active' | 'archived';
}): WorkItemListFilters | null {
  const base: WorkItemListFilters = {
    type: options.type,
    assigneeId: options.assigneeId,
    sprintId: options.sprintId,
    labels: options.labels,
    recordStatus: options.recordStatus,
    ...options.hierarchy,
  };

  if (options.accessible === 'all') {
    return { ...base, projectId: options.projectId };
  }

  if (options.accessible.length === 0) {
    return null;
  }

  if (options.projectId) {
    if (!options.accessible.includes(options.projectId)) {
      return null;
    }
    return { ...base, projectId: options.projectId };
  }

  return { ...base, projectIds: options.accessible };
}

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
  const tab = parseWorkItemRecordStatus(resolvedSearchParams);
  const projectId = lockedProjectId ?? filters.projectId;
  const assigneeId = lockedAssigneeId ?? filters.assigneeId;
  const { type, sprintId, labels } = filters;
  const dbUser = await getDbUser();
  const resolvedUserId = currentUserId ?? dbUser?.id ?? null;
  const currentUserRole = dbUser?.role ?? 'member';
  const isProjectLocked = Boolean(lockedProjectId);
  const isAssigneeLocked = Boolean(lockedAssigneeId);
  const needsClientBootstrap =
    !isProjectLocked &&
    !isAssigneeLocked &&
    needsWorkspaceProjectBootstrap(resolvedSearchParams.project);

  const accessibleProjects = dbUser
    ? await listAccessibleProjectIds(dbUser.id, dbUser.role)
    : [];

  const [
    columnVisibilityBootstrap,
    projects,
    projectMembers,
    sprintsResult,
    workItemsResult,
  ] = await Promise.all([
    readWorkItemTableColumnVisibilityBootstrap(),
    safeServerFetch(getProjectList(), [], 'fetch projects for work items'),
    safeServerFetch(getUserList(), [], 'fetch users for work items'),
    safeServerFetch(
      getSprintsPaginatedServer('active', 1, 100),
      EMPTY_ACTIVE_SPRINTS_PAGE,
      'fetch sprints for work items'
    ),
    (async () => {
      const scoped = resolveScopedWorkItemFilters({
        accessible: accessibleProjects,
        projectId,
        type,
        assigneeId,
        sprintId,
        labels,
        hierarchy: workItemHierarchyListFilter(listView),
        recordStatus: tab,
      });

      if (!scoped) {
        return {
          ...EMPTY_WORK_ITEMS,
          page,
          limit,
        };
      }

      return safeServerFetch(
        getWorkItemsPaginated(page, limit, search, scoped),
        EMPTY_WORK_ITEMS,
        'fetch work items list'
      );
    })(),
  ]);

  const visibleProjects =
    accessibleProjects === 'all'
      ? projects
      : projects.filter((project) => accessibleProjects.includes(project.id));

  const activeProjects = filterActiveProjects(visibleProjects);
  const sprints = sprintsResult.sprints;
  const suggestedDefaults =
    !isProjectLocked && !isAssigneeLocked && dbUser
      ? await getSuggestedBoardDefaults(dbUser, activeProjects, sprints)
      : null;

  return (
    <WorkItemsWorkspace
      projects={isProjectLocked ? visibleProjects : activeProjects}
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
      currentUserRole={currentUserRole}
      tab={tab}
      suggestedDefaults={suggestedDefaults}
      needsClientBootstrap={needsClientBootstrap}
      initialColumnVisibility={columnVisibilityBootstrap.visibility}
      columnVisibilityHasCookie={columnVisibilityBootstrap.hasCookie}
    />
  );
}
