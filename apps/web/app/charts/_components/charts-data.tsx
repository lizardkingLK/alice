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
import type {
  ChartBoardOwnershipFilter,
  ChartBoardStatusFilter,
} from '@/app/charts/_components/charts.types';
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
  const resolved = await searchParams;
  const search =
    typeof resolved.search === 'string' ? resolved.search.trim() : '';

  const ownership =
    typeof resolved.ownership === 'string' ? resolved.ownership : 'all';
  let workspaceOwnership: ChartBoardOwnershipFilter = 'all';
  if (ownership === 'mine' || ownership === 'shared') {
    workspaceOwnership = ownership;
  }

  const status = typeof resolved.status === 'string' ? resolved.status : 'all';
  let workspaceStatus: ChartBoardStatusFilter = 'all';
  if (status === 'archived') {
    workspaceStatus = 'archived';
  } else if (status === 'active') {
    workspaceStatus = 'active';
  }

  const dbUser = await getDbUser();
  const projects = dbUser
    ? await safeServerFetch(
        getAccessibleProjectList(dbUser.id),
        [],
        'fetch projects for chart share dialog'
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

  const shareProjects = activeProjects.map((project) => ({
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
      search={search}
      ownership={workspaceOwnership}
      status={workspaceStatus}
      shareProjects={shareProjects}
      assigneeMembers={assigneeMembers}
      projects={activeProjects}
      sprints={sprints}
      suggestedDefaults={suggestedDefaults}
    />
  );
}
