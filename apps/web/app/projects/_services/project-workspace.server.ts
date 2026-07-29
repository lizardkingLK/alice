import { getDbUser } from '@/lib/auth';
import { safeServerFetch } from '@/lib/safe-server-fetch';
import {
  parseProjectDetailsTab,
  parseStandardParams,
  parseTeamStatusFilter,
  parseWorkItemFilters,
  type RawSearchParams,
} from '@/lib/search-params';
import { getUserList } from '@/app/users/_services/users.service.server';
import {
  getTeamListPaginated,
  type Team,
} from '@/app/manager/_services/teams.service.server';
import {
  getWorkItemsPaginated,
  type DbWorkItem,
} from '@/app/work-items/_services/workItem.service.server';
import {
  getProjectDetails,
  getProjectMembers,
  type Project,
  type ProjectMemberWithUser,
} from './projects.service.server';

const EMPTY_WORK_ITEMS = {
  workItems: [] as DbWorkItem[],
  totalCount: 0,
  page: 1,
  limit: 10,
  totalPages: 1,
};

const EMPTY_TEAMS = {
  teams: [] as Team[],
  totalCount: 0,
  page: 1,
  limit: 10,
  totalPages: 1,
};

type WorkItemsResult = {
  workItems: DbWorkItem[];
  totalCount: number;
  page: number;
  limit: number;
  totalPages: number;
};

type TeamsResult = {
  teams: Team[];
  totalCount: number;
  page: number;
  limit: number;
  totalPages: number;
};

function toWorkItemsPayload(
  result: WorkItemsResult,
  options: {
    readonly active: boolean;
    readonly defaultLimit: number;
    readonly search: string;
    readonly typeFilter: string;
    readonly assigneeFilter: string;
  }
) {
  return {
    initialWorkItems: options.active ? result.workItems : [],
    totalCount: result.totalCount,
    page: result.page,
    limit: options.active ? result.limit : options.defaultLimit,
    totalPages: result.totalPages,
    search: options.active ? options.search : '',
    typeFilter: options.active ? options.typeFilter : '',
    assigneeFilter: options.active ? options.assigneeFilter : '',
  };
}

function toTeamsPayload(
  result: TeamsResult,
  options: {
    readonly active: boolean;
    readonly defaultLimit: number;
    readonly search: string;
    readonly status: 'active' | 'inactive' | 'archived';
  }
) {
  return {
    items: options.active ? result.teams : [],
    totalCount: result.totalCount,
    page: result.page,
    limit: options.active ? result.limit : options.defaultLimit,
    totalPages: result.totalPages,
    search: options.active ? options.search : '',
    status: options.status,
  };
}

export type ProjectWorkspaceData = {
  project: Project;
  members: ProjectMemberWithUser[];
  allUsers: Awaited<ReturnType<typeof getUserList>>;
  currentUserId?: string | null;
  currentUserRole: string;
  workItems: {
    initialWorkItems: DbWorkItem[];
    totalCount: number;
    page: number;
    limit: number;
    totalPages: number;
    search: string;
    typeFilter: string;
    assigneeFilter: string;
  };
  teams: {
    items: Team[];
    totalCount: number;
    page: number;
    limit: number;
    totalPages: number;
    search: string;
    status: 'active' | 'inactive' | 'archived';
  };
};

/**
 * M4.2 — single RSC loader for the project detail surface
 * (details + members + users dropdown + project work items).
 */
export async function getProjectWorkspace(
  projectId: string,
  searchParams: RawSearchParams
): Promise<ProjectWorkspaceData | null> {
  const activeTab = parseProjectDetailsTab(searchParams.tab);
  const { page, limit, search } = parseStandardParams(searchParams, 10);
  const { type, assigneeId } = parseWorkItemFilters(searchParams);
  const teamStatus = parseTeamStatusFilter(searchParams.teamStatus);
  const teamsPage = activeTab === 'teams' ? page : 1;
  const teamsLimit = activeTab === 'teams' ? limit : 1;
  const teamsSearch = activeTab === 'teams' ? search : undefined;
  const isWorkItemsTab = activeTab === 'work-items';
  const workItemsPage = isWorkItemsTab ? page : 1;
  const workItemsLimit = isWorkItemsTab ? limit : 1;
  const workItemsSearch = isWorkItemsTab ? search : undefined;

  const [dbUser, projectBundle, allUsers, workItemsResult, teamsResult] =
    await Promise.all([
      getDbUser(),
      safeServerFetch<[Project, ProjectMemberWithUser[]] | null>(
        Promise.all([
          getProjectDetails(projectId),
          getProjectMembers(projectId),
        ]),
        null,
        'load project details'
      ),
      safeServerFetch(getUserList(), [], 'fetch users for project members'),
      safeServerFetch(
        getWorkItemsPaginated(workItemsPage, workItemsLimit, workItemsSearch, {
          projectId,
          ...(isWorkItemsTab ? { type, assigneeId } : {}),
        }),
        EMPTY_WORK_ITEMS,
        'fetch project work items'
      ),
      safeServerFetch(
        getTeamListPaginated(
          teamsPage,
          teamsLimit,
          teamStatus,
          teamsSearch,
          projectId
        ),
        EMPTY_TEAMS,
        'fetch project teams'
      ),
    ]);

  if (!projectBundle) {
    return null;
  }

  const [project, members] = projectBundle;

  return {
    project,
    members,
    allUsers,
    currentUserId: dbUser?.id,
    currentUserRole: dbUser?.role ?? 'member',
    workItems: toWorkItemsPayload(workItemsResult, {
      active: isWorkItemsTab,
      defaultLimit: limit,
      search,
      typeFilter: type ?? '',
      assigneeFilter: assigneeId ?? '',
    }),
    teams: toTeamsPayload(teamsResult, {
      active: activeTab === 'teams',
      defaultLimit: limit,
      search,
      status: teamStatus,
    }),
  };
}
