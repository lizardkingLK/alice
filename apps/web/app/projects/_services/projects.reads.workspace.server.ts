import { getDbUser } from '@/lib/auth';
import { canAccessProjectWorkspace } from '@/lib/projects/project-workspace-access';
import { safeServerFetch } from '@/lib/safe-server-fetch';
import {
  parseProjectDetailsTab,
  parseSprintListStatus,
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
  getActiveProjectTeams,
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
} from '@/app/projects/_services/projects.reads.server';
import type { ProjectWorkspaceBundlePayload } from '@/app/projects/_helpers/project-workspace-bundle';
import { getProjectWorkspaceBundleFromRpc } from '@/app/projects/_services/projects.reads.workspace-bundle.supabase.server';
import { getSprintsPaginatedServer } from '@/app/sprints/_services/sprints.reads.server';
import type {
  PaginatedSprints,
  Sprint,
} from '@/app/sprints/_services/sprints.mutations.client';
import { UserRoleEnum } from '@repo/types';

export type GetProjectWorkspaceOptions = {
  /** Shell-prefetched project — skips a second details read. */
  readonly project?: Project | null;
};

type ProjectDetailsTab = ReturnType<typeof parseProjectDetailsTab>;

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

const EMPTY_SPRINTS: PaginatedSprints = {
  sprints: [],
  pagination: { page: 1, limit: 10, totalCount: 0, totalPages: 1 },
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

function resolveSprintsFetchLimit(
  isSprintsTab: boolean,
  isWorkItemsTab: boolean,
  pageLimit: number
): number {
  if (isSprintsTab) {
    return pageLimit;
  }
  if (isWorkItemsTab) {
    return 100;
  }
  return 1;
}

function resolveSprintListStatusForTab(
  isWorkItemsTab: boolean,
  searchParams: RawSearchParams
): 'active' | 'archived' {
  if (isWorkItemsTab) {
    return 'active';
  }
  return parseSprintListStatus(searchParams);
}

function shouldFetchProjectSprints(options: {
  readonly isWorkItemsTab: boolean;
  readonly isSprintsTab: boolean;
  readonly isManagerOrAdmin: boolean;
  readonly activeTab: ReturnType<typeof parseProjectDetailsTab>;
}): boolean {
  if (options.isWorkItemsTab) {
    return true;
  }
  if (!options.isManagerOrAdmin) {
    return false;
  }
  return options.isSprintsTab || options.activeTab === 'details';
}

const MANAGER_ONLY_PROJECT_TABS = new Set([
  'teams',
  'sprints',
  'integrations',
  'fields',
  'workflow',
  'types',
] as const);

function resolveWorkspaceTab(
  requestedTab: ReturnType<typeof parseProjectDetailsTab>,
  isManagerOrAdmin: boolean
): ReturnType<typeof parseProjectDetailsTab> {
  if (
    !isManagerOrAdmin &&
    (MANAGER_ONLY_PROJECT_TABS as Set<string>).has(requestedTab)
  ) {
    return 'details';
  }
  return requestedTab;
}

function shouldFetchAllUsers(
  activeTab: ReturnType<typeof parseProjectDetailsTab>
) {
  return (
    activeTab === 'members' || activeTab === 'teams' || activeTab === 'details'
  );
}

function shouldFetchProjectTeams(options: {
  readonly activeTab: ReturnType<typeof parseProjectDetailsTab>;
  readonly isManagerOrAdmin: boolean;
}): boolean {
  if (!options.isManagerOrAdmin) {
    return false;
  }
  return options.activeTab === 'teams' || options.activeTab === 'details';
}

function shouldFetchProjectWorkItems(options: {
  readonly activeTab: ReturnType<typeof parseProjectDetailsTab>;
}): boolean {
  return options.activeTab === 'work-items' || options.activeTab === 'details';
}

function resolveWorkItemListQuery(options: {
  readonly isWorkItemsTab: boolean;
  readonly page: number;
  readonly limit: number;
  readonly search: string;
}): {
  readonly page: number;
  readonly limit: number;
  readonly search: string | undefined;
} {
  if (options.isWorkItemsTab) {
    return {
      page: options.page,
      limit: options.limit,
      search: options.search,
    };
  }
  return { page: 1, limit: 1, search: undefined };
}

function resolveWorkItemRecordStatusForRole(options: {
  readonly isManagerOrAdmin: boolean;
  readonly isWorkItemsTab: boolean;
  readonly parsedRecordStatus: 'active' | 'archived';
}): 'active' | 'archived' {
  if (!options.isManagerOrAdmin && options.isWorkItemsTab) {
    return 'active';
  }
  return options.parsedRecordStatus;
}

async function fetchProjectUsers(
  shouldLoad: boolean
): Promise<Awaited<ReturnType<typeof getUserList>>> {
  if (!shouldLoad) {
    return [];
  }
  return safeServerFetch(getUserList(), [], 'fetch users for project members');
}

async function fetchProjectWorkItemsBundle(options: {
  readonly shouldLoad: boolean;
  readonly isWorkItemsTab: boolean;
  readonly page: number;
  readonly limit: number;
  readonly search: string;
  readonly projectId: string;
  readonly type: ReturnType<typeof parseWorkItemFilters>['type'];
  readonly assigneeId: string | undefined;
  readonly labels: string[] | undefined;
  readonly sprintId: string | undefined;
  readonly recordStatus: 'active' | 'archived';
  readonly listView: ReturnType<typeof parseWorkItemListView>;
}): Promise<WorkItemsResult> {
  if (!options.shouldLoad) {
    return EMPTY_WORK_ITEMS;
  }

  const listQuery = resolveWorkItemListQuery({
    isWorkItemsTab: options.isWorkItemsTab,
    page: options.page,
    limit: options.limit,
    search: options.search,
  });

  return safeServerFetch(
    getWorkItemsPaginated(
      listQuery.page,
      listQuery.limit,
      listQuery.search,
      buildProjectWorkItemFilters({
        projectId: options.projectId,
        isWorkItemsTab: options.isWorkItemsTab,
        type: options.type,
        assigneeId: options.assigneeId,
        labels: options.labels,
        sprintId: options.sprintId,
        recordStatus: options.recordStatus,
        listView: options.listView,
      })
    ),
    EMPTY_WORK_ITEMS,
    'fetch project work items'
  );
}

async function fetchProjectTeamsBundle(options: {
  readonly shouldLoad: boolean;
  readonly page: number;
  readonly limit: number;
  readonly status: ReturnType<typeof parseTeamStatusFilter>;
  readonly search: string | undefined;
  readonly projectId: string;
}): Promise<TeamsResult> {
  if (!options.shouldLoad) {
    return EMPTY_TEAMS;
  }
  return safeServerFetch(
    getTeamListPaginated(
      options.page,
      options.limit,
      options.status,
      options.search,
      options.projectId
    ),
    EMPTY_TEAMS,
    'fetch project teams'
  );
}

async function fetchProjectSprintsBundle(options: {
  readonly shouldLoad: boolean;
  readonly status: 'active' | 'archived';
  readonly page: number;
  readonly limit: number;
  readonly search: string | undefined;
  readonly projectId: string;
}): Promise<PaginatedSprints> {
  if (!options.shouldLoad) {
    return EMPTY_SPRINTS;
  }
  return safeServerFetch(
    getSprintsPaginatedServer(
      options.status,
      options.page,
      options.limit,
      options.search,
      { projectId: options.projectId }
    ),
    EMPTY_SPRINTS,
    'fetch project sprints'
  );
}

async function fetchBoardRuleTeams(
  shouldLoad: boolean,
  projectId: string
): Promise<Team[]> {
  if (!shouldLoad) {
    return [];
  }
  return safeServerFetch(
    getActiveProjectTeams(projectId),
    [] as Team[],
    'fetch board rule teams'
  );
}

function buildProjectWorkItemFilters(options: {
  readonly projectId: string;
  readonly isWorkItemsTab: boolean;
  readonly type: ReturnType<typeof parseWorkItemFilters>['type'];
  readonly assigneeId: string | undefined;
  readonly labels: string[] | undefined;
  readonly sprintId: string | undefined;
  readonly recordStatus: 'active' | 'archived';
  readonly listView: ReturnType<typeof parseWorkItemListView>;
}) {
  if (!options.isWorkItemsTab) {
    return { projectId: options.projectId };
  }

  return {
    projectId: options.projectId,
    type: options.type,
    assigneeId: options.assigneeId,
    labels: options.labels,
    sprintId: options.sprintId,
    recordStatus: options.recordStatus,
    ...workItemHierarchyListFilter(options.listView),
  };
}

function toWorkItemsPayload(
  result: WorkItemsResult,
  options: {
    readonly active: boolean;
    readonly defaultLimit: number;
    readonly search: string;
    readonly typeFilter: string;
    readonly assigneeFilter: string;
    readonly sprintFilter: string;
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
    sprintFilter: options.active ? options.sprintFilter : '',
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

function toSprintsPayload(
  result: PaginatedSprints,
  options: {
    readonly active: boolean;
    readonly defaultLimit: number;
    readonly search: string;
    readonly filterTab: 'active' | 'archived';
  }
) {
  return {
    sprints: options.active ? result.sprints : ([] as Sprint[]),
    pagination: {
      page: options.active ? result.pagination.page : 1,
      limit: options.active ? result.pagination.limit : options.defaultLimit,
      totalCount: result.pagination.totalCount,
      totalPages: options.active ? result.pagination.totalPages : 1,
    },
    filterTab: options.filterTab,
    search: options.active ? options.search : '',
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
    sprintFilter: string;
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
  readonly sprints: {
    sprints: Sprint[];
    pagination: PaginatedSprints['pagination'];
    filterTab: 'active' | 'archived';
    search: string;
  };
  readonly boardRuleTeams: Team[];
};

export type ProjectWorkspaceDenied = {
  readonly access: 'denied';
  readonly project: Project;
};

export type ProjectWorkspaceResult =
  ProjectWorkspaceAllowed | ProjectWorkspaceDenied | null;

type ProjectWorkspacePlan = {
  readonly activeTab: ProjectDetailsTab;
  readonly isWorkItemsTab: boolean;
  readonly isSprintsTab: boolean;
  readonly isDetailsTab: boolean;
  readonly isManagerOrAdmin: boolean;
  readonly page: number;
  readonly limit: number;
  readonly search: string;
  readonly type: ReturnType<typeof parseWorkItemFilters>['type'];
  readonly assigneeId: string | undefined;
  readonly labels: string[] | undefined;
  readonly sprintId: string | undefined;
  readonly listView: ReturnType<typeof parseWorkItemListView>;
  readonly teamStatus: ReturnType<typeof parseTeamStatusFilter>;
  readonly shouldLoadSprints: boolean;
  readonly shouldLoadTeams: boolean;
  readonly shouldLoadWorkItems: boolean;
  readonly shouldLoadUsers: boolean;
  readonly sprintListStatus: 'active' | 'archived';
  readonly sprintsLimit: number;
  readonly sprintsPage: number;
  readonly sprintsSearch: string | undefined;
  readonly teamsPage: number;
  readonly teamsLimit: number;
  readonly teamsSearch: string | undefined;
  readonly workItemRecordStatus: 'active' | 'archived';
};

function buildProjectWorkspacePlan(
  searchParams: RawSearchParams,
  role: string
): ProjectWorkspacePlan {
  const requestedTab = parseProjectDetailsTab(searchParams.tab);
  const { page, limit, search } = parseStandardParams(searchParams, 10);
  const { type, assigneeId, labels, sprintId } =
    parseWorkItemFilters(searchParams);
  const listView = parseWorkItemListView(searchParams.view);
  const teamStatus = parseTeamStatusFilter(searchParams.teamStatus);
  const isManagerOrAdmin =
    role === UserRoleEnum.admin || role === UserRoleEnum.manager;
  const activeTab = resolveWorkspaceTab(requestedTab, isManagerOrAdmin);
  const isWorkItemsTab = activeTab === 'work-items';
  const isSprintsTab = activeTab === 'sprints' && isManagerOrAdmin;
  const isDetailsTab = activeTab === 'details';

  return {
    activeTab,
    isWorkItemsTab,
    isSprintsTab,
    isDetailsTab,
    isManagerOrAdmin,
    page,
    limit,
    search,
    type,
    assigneeId,
    labels,
    sprintId,
    listView,
    teamStatus,
    shouldLoadSprints: shouldFetchProjectSprints({
      isWorkItemsTab,
      isSprintsTab,
      isManagerOrAdmin,
      activeTab,
    }),
    shouldLoadTeams: shouldFetchProjectTeams({
      activeTab,
      isManagerOrAdmin,
    }),
    shouldLoadWorkItems: shouldFetchProjectWorkItems({ activeTab }),
    shouldLoadUsers: shouldFetchAllUsers(activeTab),
    sprintListStatus: resolveSprintListStatusForTab(
      isWorkItemsTab,
      searchParams
    ),
    sprintsLimit: resolveSprintsFetchLimit(isSprintsTab, isWorkItemsTab, limit),
    sprintsPage: isSprintsTab ? page : 1,
    sprintsSearch: isSprintsTab ? search : undefined,
    teamsPage: activeTab === 'teams' ? page : 1,
    teamsLimit: activeTab === 'teams' ? limit : 1,
    teamsSearch: activeTab === 'teams' ? search : undefined,
    workItemRecordStatus: resolveWorkItemRecordStatusForRole({
      isManagerOrAdmin,
      isWorkItemsTab,
      parsedRecordStatus: parseWorkItemRecordStatus(searchParams),
    }),
  };
}

function workItemsFromBundleCounts(totalCount: number): WorkItemsResult {
  return {
    workItems: [],
    totalCount,
    page: 1,
    limit: 1,
    totalPages: 1,
  };
}

function teamsFromBundleCounts(totalCount: number): TeamsResult {
  return {
    teams: [],
    totalCount,
    page: 1,
    limit: 1,
    totalPages: 1,
  };
}

function sprintsFromBundleCounts(totalCount: number): PaginatedSprints {
  return {
    sprints: [],
    pagination: {
      page: 1,
      limit: 1,
      totalCount,
      totalPages: 1,
    },
  };
}

async function loadProjectWorkspaceSlices(options: {
  readonly projectId: string;
  readonly plan: ProjectWorkspacePlan;
  readonly bundle: ProjectWorkspaceBundlePayload | null;
}): Promise<{
  readonly members: ProjectMemberWithUser[];
  readonly allUsers: Awaited<ReturnType<typeof getUserList>>;
  readonly workItemsResult: WorkItemsResult;
  readonly teamsResult: TeamsResult;
  readonly sprintsResult: PaginatedSprints;
  readonly boardRuleTeams: Team[];
}> {
  const { projectId, plan, bundle } = options;
  const useRpcCounts = Boolean(bundle) && plan.isDetailsTab;

  const [
    members,
    allUsers,
    workItemsResult,
    teamsResult,
    sprintsResult,
    boardRuleTeams,
  ] = await Promise.all([
    bundle
      ? Promise.resolve(bundle.members)
      : safeServerFetch(
          getProjectMembers(projectId),
          [] as ProjectMemberWithUser[],
          'load project members'
        ),
    fetchProjectUsers(plan.shouldLoadUsers),
    fetchProjectWorkItemsBundle({
      shouldLoad: plan.shouldLoadWorkItems && !useRpcCounts,
      isWorkItemsTab: plan.isWorkItemsTab,
      page: plan.page,
      limit: plan.limit,
      search: plan.search,
      projectId,
      type: plan.type,
      assigneeId: plan.assigneeId,
      labels: plan.labels,
      sprintId: plan.sprintId,
      recordStatus: plan.workItemRecordStatus,
      listView: plan.listView,
    }),
    fetchProjectTeamsBundle({
      shouldLoad: plan.shouldLoadTeams && !useRpcCounts,
      page: plan.teamsPage,
      limit: plan.teamsLimit,
      status: plan.teamStatus,
      search: plan.teamsSearch,
      projectId,
    }),
    fetchProjectSprintsBundle({
      shouldLoad: plan.shouldLoadSprints && !useRpcCounts,
      status: plan.sprintListStatus,
      page: plan.sprintsPage,
      limit: plan.sprintsLimit,
      search: plan.sprintsSearch,
      projectId,
    }),
    fetchBoardRuleTeams(
      plan.activeTab === 'workflow' && plan.isManagerOrAdmin,
      projectId
    ),
  ]);

  if (!useRpcCounts || !bundle) {
    return {
      members,
      allUsers,
      workItemsResult,
      teamsResult,
      sprintsResult,
      boardRuleTeams,
    };
  }

  return {
    members,
    allUsers,
    workItemsResult: workItemsFromBundleCounts(bundle.workItemTotal),
    teamsResult: teamsFromBundleCounts(bundle.teamTotal),
    sprintsResult: sprintsFromBundleCounts(bundle.sprintTotal),
    boardRuleTeams,
  };
}

/**
 * M4.2 / M8 — RSC loader for the project detail surface.
 * Prefers `get_project_workspace_bundle` for project + members + badge counts;
 * tab list pages stay on PostgREST. Gates heavy loads behind ACL.
 */
export async function getProjectWorkspace(
  projectId: string,
  searchParams: RawSearchParams,
  options?: GetProjectWorkspaceOptions
): Promise<ProjectWorkspaceResult> {
  const preloaded = options?.project ?? null;
  const [dbUser, fetchedProject] = await Promise.all([
    getDbUser(),
    preloaded
      ? Promise.resolve(preloaded)
      : safeServerFetch(
          getProjectDetails(projectId),
          null,
          'load project details'
        ),
  ]);

  if (!fetchedProject) {
    return null;
  }

  if (!dbUser) {
    return { access: 'denied', project: fetchedProject };
  }

  const allowed = await canAccessProjectWorkspace(dbUser.id, projectId);
  if (!allowed) {
    console.warn('warn. project workspace access denied: role gate');
    return { access: 'denied', project: fetchedProject };
  }

  const plan = buildProjectWorkspacePlan(searchParams, dbUser.role);
  const bundle = await getProjectWorkspaceBundleFromRpc(projectId);
  const project = preloaded ?? bundle?.project ?? fetchedProject;
  const slices = await loadProjectWorkspaceSlices({
    projectId,
    plan,
    bundle,
  });

  return {
    access: 'allowed',
    project,
    members: slices.members,
    allUsers: slices.allUsers,
    currentUserId: dbUser.id,
    currentUserRole: dbUser.role,
    workItems: toWorkItemsPayload(slices.workItemsResult, {
      active: plan.isWorkItemsTab,
      defaultLimit: plan.limit,
      search: plan.search,
      typeFilter: plan.type ?? '',
      assigneeFilter: plan.assigneeId ?? '',
      sprintFilter: plan.sprintId ?? '',
      labelsFilter: plan.labels ?? [],
      listView: plan.listView,
      tab: plan.workItemRecordStatus,
    }),
    teams: toTeamsPayload(slices.teamsResult, {
      active: plan.activeTab === 'teams',
      defaultLimit: plan.limit,
      search: plan.search,
      status: plan.teamStatus,
    }),
    sprints: toSprintsPayload(slices.sprintsResult, {
      active: plan.isSprintsTab || plan.isWorkItemsTab,
      defaultLimit: plan.limit,
      search: plan.search,
      filterTab: plan.sprintListStatus,
    }),
    boardRuleTeams: slices.boardRuleTeams,
  };
}
