import { BoardWorkspace } from '@/app/board/_components/board-workspace';
import { needsWorkspaceProjectBootstrap } from '@/app/board/_helpers/workspace-defaults-shared';
import {
  EMPTY_ACTIVE_SPRINTS_PAGE,
  getSuggestedBoardDefaults,
} from '@/app/board/_services/board-defaults.server';
import { getProjectList } from '@/app/projects/_services/projects.service.server';
import { getSprintsPaginatedServer } from '@/app/sprints/_services/sprints.service.server';
import { getUserList } from '@/app/users/_services/users.service.server';
import { getWorkItems } from '@/app/work-items/_services/workItem.service.server';
import { getDbUser } from '@/lib/auth';
import { filterActiveProjects } from '@/lib/projects/active-projects';
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

  const [projects, sprintsResult, workItems, users] = await Promise.all([
    safeServerFetch(getProjectList(), [], 'fetch projects for board'),
    safeServerFetch(
      getSprintsPaginatedServer('active', 1, 100),
      EMPTY_ACTIVE_SPRINTS_PAGE,
      'fetch sprints for board'
    ),
    safeServerFetch(
      getWorkItems(
        {
          projectId,
          sprintId,
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
  const sprints = sprintsResult.sprints;

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
