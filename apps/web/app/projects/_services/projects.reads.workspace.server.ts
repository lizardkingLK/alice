import { getDbUser } from '@/lib/auth';
import { canAccessProjectWorkspace } from '@/lib/projects/project-workspace-access';
import { safeServerFetch } from '@/lib/safe-server-fetch';
import {
  parseProjectDetailsTab,
  parseStandardParams,
  parseTeamStatusFilter,
  parseWorkItemFilters,
  parseWorkItemListView,
  parseWorkItemRecordStatus,
  workItemHierarchyListFilter,
  type RawSearchParams,
} from '@/lib/search-params';
import { getUserList } from '@/app/users/_services/users.reads.server';
import {
  getTeamListPaginated,
  type Team,
} from '@/app/manager/_services/teams.reads.server';
import {
  getWorkItemsPaginated,
  type DbWorkItem,
} from '@/app/work-items/_services/work-items.reads.server';
import {
  getProjectDetails,
  getProjectMembers,
  type Project,
  type ProjectMemberWithUser,
} from './projects.reads.server';

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
    readonly labelsFilter: readonly string[];
    readonly listView: 'flat' | 'hierarchy';
    readonly tab: 'active' | 'archived';
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
    labelsFilter: options.active ? [...options.labelsFilter] : [],
    listView: options.active ? options.listView : 'flat',
    tab: options.tab,
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

export type ProjectWorkspaceAllowed = {
  readonly access: 'allowed';
  readonly project: Project;
  readonly members: ProjectMemberWithUser[];
  readonly allUsers: Awaited<ReturnType<typeof getUserList>>;
  readonly currentUserId?: string | null;
  readonly currentUserRole: string;
  readonly workItems: {
    initialWorkItems: DbWorkItem[];
    totalCount: number;
    page: number;
    limit: number;
    totalPages: number;
    search: string;
    typeFilter: string;
    assigneeFilter: string;
    labelsFilter: string[];
    listView: 'flat' | 'hierarchy';
    tab: 'active' | 'archived';
  };
  readonly teams: {
    items: Team[];
    totalCount: number;
    page: number;
    limit: number;
    totalPages: number;
    search: string;
    status: 'active' | 'inactive' | 'archived';
  };
};

export type ProjectWorkspaceDenied = {
  readonly access: 'denied';
  readonly project: Project;
};

export type ProjectWorkspaceResult =
  ProjectWorkspaceAllowed | ProjectWorkspaceDenied | null;

/**
 * M4.2 — single RSC loader for the project detail surface
 * (details + members + users dropdown + project work items).
 * Gates heavy loads behind admin | owner | project_members.
 */
export async function getProjectWorkspace(
  projectId: string,
  searchParams: RawSearchParams
): Promise<ProjectWorkspaceResult> {
  const [dbUser, project] = await Promise.all([
    getDbUser(),
    safeServerFetch(getProjectDetails(projectId), null, 'load project details'),
  ]);

  if (!project) {
    return null;
  }

  if (!dbUser) {
    return { access: 'denied', project };
  }

  const allowed = await canAccessProjectWorkspace(
    dbUser.id,
    dbUser.role,
    projectId
  );
  if (!allowed) {
    console.warn('warn. project workspace access denied: role gate');
    return { access: 'denied', project };
  }

  const activeTab = parseProjectDetailsTab(searchParams.tab);
  const { page, limit, search } = parseStandardParams(searchParams, 10);
  const { type, assigneeId, labels } = parseWorkItemFilters(searchParams);
  const listView = parseWorkItemListView(searchParams.view);
  const teamStatus = parseTeamStatusFilter(searchParams.teamStatus);
  const teamsPage = activeTab === 'teams' ? page : 1;
  const teamsLimit = activeTab === 'teams' ? limit : 1;
  const teamsSearch = activeTab === 'teams' ? search : undefined;
  const isWorkItemsTab = activeTab === 'work-items';
  const workItemsPage = isWorkItemsTab ? page : 1;
  const workItemsLimit = isWorkItemsTab ? limit : 1;
  const workItemsSearch = isWorkItemsTab ? search : undefined;
  const workItemRecordStatus = parseWorkItemRecordStatus(searchParams);

  const [members, allUsers, workItemsResult, teamsResult] = await Promise.all([
    safeServerFetch(
      getProjectMembers(projectId),
      [] as ProjectMemberWithUser[],
      'load project members'
    ),
    safeServerFetch(getUserList(), [], 'fetch users for project members'),
    safeServerFetch(
      getWorkItemsPaginated(workItemsPage, workItemsLimit, workItemsSearch, {
        projectId,
        ...(isWorkItemsTab
          ? {
              type,
              assigneeId,
              labels,
              recordStatus: workItemRecordStatus,
              ...workItemHierarchyListFilter(listView),
            }
          : {}),
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

  return {
    access: 'allowed',
    project,
    members,
    allUsers,
    currentUserId: dbUser.id,
    currentUserRole: dbUser.role,
    workItems: toWorkItemsPayload(workItemsResult, {
      active: isWorkItemsTab,
      defaultLimit: limit,
      search,
      typeFilter: type ?? '',
      assigneeFilter: assigneeId ?? '',
      labelsFilter: labels ?? [],
      listView,
      tab: workItemRecordStatus,
    }),
    teams: toTeamsPayload(teamsResult, {
      active: activeTab === 'teams',
      defaultLimit: limit,
      search,
      status: teamStatus,
    }),
  };
}
