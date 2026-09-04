import { BoardWorkspace } from '@/app/board/_components/board-workspace';
import { needsWorkspaceProjectBootstrap } from '@/app/board/_helpers/workspace-defaults-shared';
import {
  EMPTY_ACTIVE_SPRINTS_PAGE,
  getSuggestedBoardDefaults,
} from '@/app/board/_services/board.reads.defaults.server';
import { getSprintsPaginatedServer } from '@/app/sprints/_services/sprints.reads.server';
import { getUserList } from '@/app/users/_services/users.reads.server';
import { getWorkItems } from '@/app/work-items/_services/work-items.reads.server';
import { getDbUser } from '@/lib/auth';
import { getAccessibleProjectList } from '@/lib/projects/accessible-project-list';
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

  const accessibleIds = dbUser ? await listAccessibleProjectIds(dbUser.id) : [];

  const scopedProjectId =
    projectId && accessibleIds.includes(projectId) ? projectId : undefined;

  const [projects, sprintsResult, workItems, users] = await Promise.all([
    dbUser
      ? safeServerFetch(
          getAccessibleProjectList(dbUser.id),
          [],
          'fetch projects for board'
        )
      : Promise.resolve([]),
    safeServerFetch(
      getSprintsPaginatedServer('active', 1, 100),
      EMPTY_ACTIVE_SPRINTS_PAGE,
      'fetch sprints for board'
    ),
    accessibleIds.length === 0
      ? Promise.resolve([])
      : safeServerFetch(
          getWorkItems(
            {
              projectId: scopedProjectId,
              sprintId,
              ...(scopedProjectId ? {} : { projectIds: accessibleIds }),
            },
            { includeDescription: true }
          ),
          [],
          'fetch work items for board'
        ),
    activeTab === 'calendar'
      ? safeServerFetch(getUserList(), [], 'fetch users for board calendar')
      : Promise.resolve([]),
  ]);

  const activeProjects = filterActiveProjects(projects);
  const sprints = sprintsResult.sprints.filter(
    (sprint) => !sprint.project?.id || accessibleIds.includes(sprint.project.id)
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
      projectFilter={scopedProjectId ?? ''}
      sprintFilter={sprintId ?? ''}
      allowAllFilters
      userId={dbUser?.id ?? null}
      suggestedDefaults={suggestedDefaults}
      needsClientBootstrap={needsClientBootstrap}
    />
  );
}
