import { KanbanBoard } from '@/app/board/_components/kanban-board';
import { needsWorkspaceProjectBootstrap } from '@/app/board/_helpers/workspace-defaults-shared';
import {
  EMPTY_ACTIVE_SPRINTS_PAGE,
  getSuggestedBoardDefaults,
} from '@/app/board/_services/board-defaults.server';
import { getProjectList } from '@/app/projects/_services/projects.service.server';
import { getSprintsPaginatedServer } from '@/app/sprints/_services/sprints.service.server';
import { getWorkItems } from '@/app/work-items/_services/workItem.service.server';
import { getDbUser } from '@/lib/auth';
import { filterActiveProjects } from '@/lib/projects/active-projects';
import { safeServerFetch } from '@/lib/safe-server-fetch';
import {
  parseWorkItemFilters,
  type RawSearchParams,
} from '@/lib/search-params';

type BoardDataProps = {
  readonly searchParams: Promise<RawSearchParams>;
};

export async function BoardData({ searchParams }: Readonly<BoardDataProps>) {
  const resolvedSearchParams = await searchParams;
  const { projectId, sprintId } = parseWorkItemFilters(resolvedSearchParams);
  const dbUser = await getDbUser();
  const role = dbUser?.role ?? 'member';
  const isAdmin = role === 'admin';

  const [projects, sprintsResult] = await Promise.all([
    safeServerFetch(getProjectList(), [], 'fetch projects for board'),
    safeServerFetch(
      getSprintsPaginatedServer('active', 1, 100),
      EMPTY_ACTIVE_SPRINTS_PAGE,
      'fetch sprints for board'
    ),
  ]);

  const activeProjects = filterActiveProjects(projects);
  const sprints = sprintsResult.sprints;

  const suggestedDefaults = dbUser
    ? await getSuggestedBoardDefaults(dbUser, activeProjects, sprints)
    : null;

  const needsClientBootstrap = needsWorkspaceProjectBootstrap(
    resolvedSearchParams.project
  );
  // Always fetch: missing/all projectId means unfiltered board data.
  // needsClientBootstrap only drives client-side URL seeding from localStorage.
  const workItems = await safeServerFetch(
    getWorkItems({
      projectId,
      sprintId,
    }),
    [],
    'fetch work items for board'
  );
  const boardItems = workItems.filter((item) => item.status !== 'Draft');

  return (
    <KanbanBoard
      initialWorkItems={boardItems}
      projects={activeProjects}
      sprints={sprints}
      projectFilter={projectId ?? ''}
      sprintFilter={sprintId ?? ''}
      allowAllFilters={isAdmin}
      userId={dbUser?.id ?? null}
      suggestedDefaults={suggestedDefaults}
      needsClientBootstrap={needsClientBootstrap}
    />
  );
}
