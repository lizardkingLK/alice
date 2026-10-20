import type { ProjectTeamMemberCapacity } from '@/app/backlog/_helpers/backlog-sprint-capacity';
import { getBacklogWorkspaceBundleFromRpc } from '@/app/backlog/_services/backlog.reads.supabase.server';
import { getProjectTeamMemberCapacities } from '@/app/backlog/_services/backlog.team-capacity.server';
import type { Project as DbProject } from '@/app/projects/_services/projects.mutations.client';
import { EMPTY_ACTIVE_SPRINTS_PAGE } from '@/app/board/_services/board.reads.defaults.server';
import {
  mapDbSprintToSprint,
  type Sprint,
} from '@/app/sprints/_services/sprints.mutations.client';
import { getSprintsPaginatedServer } from '@/app/sprints/_services/sprints.reads.server';
import type { User as DbUser } from '@/app/users/_services/users.mutations.client';
import { getUserList } from '@/app/users/_services/users.reads.server';
import {
  getWorkItems,
  type DbWorkItem,
} from '@/app/work-items/_services/work-items.reads.server';
import { getDbUser } from '@/lib/auth';
import { getAccessibleProjectList } from '@/lib/projects/accessible-project-list';
import { filterActiveProjects } from '@/lib/projects/active-projects';
import { listAccessibleProjectIds } from '@/lib/projects/project-workspace-access';
import { safeServerFetch } from '@/lib/safe-server-fetch';

export type BacklogWorkspaceData = {
  projects: DbProject[];
  projectMembers: DbUser[];
  teamCapacities: ProjectTeamMemberCapacity[];
  initialWorkItems: DbWorkItem[];
  sprints: Sprint[];
  userRole: string;
  currentUserId?: string | null;
  error: string | null;
};

type BacklogBundleSlices = {
  initialWorkItems: DbWorkItem[];
  sprints: Sprint[];
  teamCapacities: ProjectTeamMemberCapacity[];
};

const EMPTY_BUNDLE: BacklogBundleSlices = {
  initialWorkItems: [],
  sprints: [],
  teamCapacities: [],
};

/**
 * Parallel PostgREST fallback when the workspace RPC is missing or fails.
 * Keeps projects/users on their cached list readers either way.
 */
async function loadBacklogBundleFallback(
  accessibleIds: readonly string[]
): Promise<BacklogBundleSlices & { error: string | null }> {
  let fetchError: string | null = null;

  const [initialWorkItems, sprintsResult, teamCapacities] = await Promise.all([
    safeServerFetch(
      getWorkItems({ projectIds: [...accessibleIds] }),
      [],
      'fetch work items for backlog'
    ),
    getSprintsPaginatedServer('active', 1, 100, undefined, {
      projectIds: [...accessibleIds],
    }).catch((error: unknown) => {
      fetchError =
        error instanceof Error
          ? error.message
          : 'Failed to fetch backlog sprints.';
      console.error('error. failed to fetch backlog sprints:', fetchError);
      return EMPTY_ACTIVE_SPRINTS_PAGE;
    }),
    safeServerFetch(
      getProjectTeamMemberCapacities(accessibleIds),
      [],
      'fetch team capacities for backlog'
    ),
  ]);

  return {
    initialWorkItems,
    sprints: sprintsResult.sprints,
    teamCapacities,
    error: fetchError,
  };
}

async function loadBacklogBundle(
  accessibleIds: readonly string[]
): Promise<BacklogBundleSlices & { error: string | null }> {
  if (accessibleIds.length === 0) {
    return { ...EMPTY_BUNDLE, error: null };
  }

  const fromRpc = await getBacklogWorkspaceBundleFromRpc(accessibleIds);
  if (fromRpc) {
    return {
      initialWorkItems: fromRpc.workItems,
      sprints: fromRpc.sprintRows.map((row) => mapDbSprintToSprint(row)),
      teamCapacities: fromRpc.teamCapacities,
      error: null,
    };
  }

  return loadBacklogBundleFallback(accessibleIds);
}

/** M4.1 / M8.2 — RSC loader for the backlog planning surface. */
export async function getBacklogWorkspace(): Promise<BacklogWorkspaceData> {
  const dbUser = await getDbUser();
  const userRole = dbUser?.role ?? 'member';
  const accessibleIds = dbUser ? await listAccessibleProjectIds(dbUser.id) : [];

  const [projects, projectMembers, bundle] = await Promise.all([
    dbUser
      ? safeServerFetch(
          getAccessibleProjectList(dbUser.id),
          [],
          'fetch projects for backlog'
        )
      : Promise.resolve([]),
    safeServerFetch(getUserList(), [], 'fetch users for backlog'),
    loadBacklogBundle(accessibleIds),
  ]);

  const activeProjects = filterActiveProjects(projects);

  return {
    projects: activeProjects,
    projectMembers,
    teamCapacities: bundle.teamCapacities,
    initialWorkItems: bundle.initialWorkItems,
    sprints: bundle.sprints,
    userRole,
    currentUserId: dbUser?.id,
    error: bundle.error,
  };
}
