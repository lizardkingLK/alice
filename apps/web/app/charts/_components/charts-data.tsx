import { redirect } from 'next/navigation';
import type { RawSearchParams } from '@/lib/search-params';
import { getDbUser } from '@/lib/auth';
import { safeServerFetch } from '@/lib/safe-server-fetch';
import { getAccessibleProjectList } from '@/lib/projects/accessible-project-list';
import { filterActiveProjects } from '@/lib/projects/active-projects';
import {
  EMPTY_ACTIVE_SPRINTS_PAGE,
  getSuggestedBoardDefaults,
} from '@/app/board/_services/board.reads.defaults.server';
import { ChartsWorkspace } from '@/app/charts/_components/charts-workspace';
import { getAccessibleChartWorkspace } from '@/app/charts/_services/charts.reads.server';
import { getProjectMembersByProjectIds } from '@/app/projects/_services/projects.reads.server';
import { unionProjectMembers } from '@/app/work-items/_helpers/work-item-assignee-filter-members';
import { getSprintsPaginatedServer } from '@/app/sprints/_services/sprints.reads.server';

type ChartsDataProps = {
  readonly searchParams: Promise<RawSearchParams>;
  readonly workspaceId: string;
  readonly currentUserId: string;
  readonly focusWidgetId?: string;
};

export async function ChartsData({
  searchParams,
  workspaceId,
  currentUserId,
  focusWidgetId,
}: Readonly<ChartsDataProps>) {
  // Keep awaiting searchParams so Next can associate the request with the URL.
  await searchParams;

  const initialWorkspace = await safeServerFetch(
    getAccessibleChartWorkspace(workspaceId, currentUserId),
    null,
    'fetch chart workspace'
  );
  if (!initialWorkspace) {
    redirect('/charts');
  }

  const dbUser = await getDbUser();
  const projects = dbUser
    ? await safeServerFetch(
        getAccessibleProjectList(dbUser.id),
        [],
        'fetch projects for chart workspace defaults'
      )
    : [];
  const activeProjects = filterActiveProjects(projects);
  const projectIds = activeProjects.map((project) => project.id);
  const [sprintsResult, membersByProjectId] = await Promise.all([
    dbUser
      ? safeServerFetch(
          getSprintsPaginatedServer('active', 1, 100),
          EMPTY_ACTIVE_SPRINTS_PAGE,
          'fetch active sprints for chart defaults'
        )
      : Promise.resolve(EMPTY_ACTIVE_SPRINTS_PAGE),
    dbUser && projectIds.length > 0
      ? safeServerFetch(
          getProjectMembersByProjectIds(projectIds),
          {},
          'fetch project members for chart assignee filter'
        )
      : Promise.resolve({}),
  ]);
  const sprints = sprintsResult.sprints;
  const suggestedDefaults = dbUser
    ? await getSuggestedBoardDefaults(dbUser, activeProjects, sprints)
    : null;

  const accessibleProjects = activeProjects.map((project) => ({
    id: project.id,
    name: project.name,
  }));
  const assigneeMembers = unionProjectMembers(membersByProjectId).map(
    (member) => ({
      id: member.id,
      name: member.name,
      email: member.email,
      profilePicture: member.profile_picture ?? null,
    })
  );

  return (
    <ChartsWorkspace
      workspaceId={workspaceId}
      currentUserId={currentUserId}
      focusWidgetId={focusWidgetId}
      initialWorkspace={initialWorkspace}
      shareProjects={accessibleProjects}
      assigneeMembers={assigneeMembers}
      projects={activeProjects}
      sprints={sprints}
      suggestedDefaults={suggestedDefaults}
    />
  );
}
