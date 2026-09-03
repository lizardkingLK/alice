import { BoardWorkspace } from '@/app/board/_components/board-workspace';
import { needsWorkspaceProjectBootstrap } from '@/app/board/_helpers/workspace-defaults-shared';
import {
  EMPTY_ACTIVE_SPRINTS_PAGE,
  getSuggestedBoardDefaults,
} from '@/app/board/_services/board.reads.defaults.server';
import { getProjectList } from '@/app/projects/_services/projects.reads.server';
import { getSprintsPaginatedServer } from '@/app/sprints/_services/sprints.reads.server';
import { getUserList } from '@/app/users/_services/users.reads.server';
import {
  getWorkItems,
  type WorkItemListFilters,
} from '@/app/work-items/_services/work-items.reads.server';
import { getDbUser } from '@/lib/auth';
import { filterActiveProjects } from '@/lib/projects/active-projects';
import { listAccessibleProjectIds } from '@/lib/projects/project-workspace-access';
import { safeServerFetch } from '@/lib/safe-server-fetch';
import {
  parseBoardPageTab,
  parseWorkItemFilters,
  type RawSearchParams,
} from '@/lib/search-params';

type BoardDataProps = {
  readonly searchParams: Promise<RawSearchParams>;
};

export async function BoardData({ searchParams }: Readonly<BoardDataProps>) {
  const resolvedSearchParams = await searchParams;
  const activeTab = parseBoardPageTab(resolvedSearchParams.tab);
  const { projectId, sprintId } = parseWorkItemFilters(resolvedSearchParams);
  const dbUser = await getDbUser();
  const role = dbUser?.role ?? 'member';
  const isAdmin = role === 'admin';

  const accessibleProjects = dbUser
    ? await listAccessibleProjectIds(dbUser.id, dbUser.role)
    : [];

  let initialWorkItemsFilters: WorkItemListFilters | null | undefined;
  if (accessibleProjects === 'all') {
    initialWorkItemsFilters = { projectId, sprintId };
  } else if (accessibleProjects.length > 0) {
    initialWorkItemsFilters = {
      projectId,
      sprintId,
      projectIds: accessibleProjects,
    };
  } else {
    initialWorkItemsFilters = null;
  }

  const [projects, sprintsResult, workItems, users] = await Promise.all([
    safeServerFetch(getProjectList(), [], 'fetch projects for board'),
    safeServerFetch(
      getSprintsPaginatedServer('active', 1, 100),
      EMPTY_ACTIVE_SPRINTS_PAGE,
      'fetch sprints for board'
    ),
    initialWorkItemsFilters === null
      ? Promise.resolve([])
      : safeServerFetch(
          getWorkItems(initialWorkItemsFilters, { includeDescription: true }),
          [],
          'fetch work items for board'
        ),
    activeTab === 'calendar'
      ? safeServerFetch(getUserList(), [], 'fetch users for board calendar')
      : Promise.resolve([]),
  ]);

  const visibleProjects =
    accessibleProjects === 'all'
      ? projects
      : projects.filter((project) => accessibleProjects.includes(project.id));

  const activeProjects = filterActiveProjects(visibleProjects);

  const sprints =
    accessibleProjects === 'all'
      ? sprintsResult.sprints
      : sprintsResult.sprints.filter(
          (sprint) =>
            sprint.project?.id && accessibleProjects.includes(sprint.project.id)
        );

  const suggestedDefaults = dbUser
    ? await getSuggestedBoardDefaults(dbUser, activeProjects, sprints)
    : null;

  const needsClientBootstrap = needsWorkspaceProjectBootstrap(
    resolvedSearchParams.project
  );
  const boardItems = workItems.filter((item) => item.status !== 'Draft');

  return (
    <BoardWorkspace
      initialWorkItems={boardItems}
      projects={activeProjects}
      sprints={sprints}
      users={users}
      projectFilter={projectId ?? ''}
      sprintFilter={sprintId ?? ''}
      allowAllFilters={isAdmin}
      userId={dbUser?.id ?? null}
      suggestedDefaults={suggestedDefaults}
      needsClientBootstrap={needsClientBootstrap}
    />
  );
}
