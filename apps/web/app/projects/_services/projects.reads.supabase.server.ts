import {
  USER_PROJECTION_WITH_ROLE,
  userRelationSelect,
  mapProjectRowForWire,
} from '@repo/types';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getDbUser, getUser } from '@/lib/auth';
import { paginationMeta } from '@/lib/db/pagination';
import {
  applyListSearch,
  aggregateCountsByKey,
  runPaginatedSelect,
  throwIfError,
  zeroCountsById,
} from '@/lib/db/query';
import { listAccessibleProjectIds } from '@/lib/projects/project-workspace-access';
import {
  ProjectStatusEnum,
  type ProjectStatusTab,
} from '@/app/projects/_helpers/project-status';
import type {
  GetProjectsPaginatedResponse,
  Project,
  ProjectMemberWithUser,
  ProjectMembersByProjectId,
} from '@/app/projects/_services/projects.mutations.shared';

const OWNER_SELECT =
  'owner:users!projects_owner_id_fkey(id, name, email, profile_picture)';
const PROJECT_MEMBER_USER_SELECT = userRelationSelect(
  'user',
  'project_members_user_id_fkey',
  USER_PROJECTION_WITH_ROLE
);

/** Explicit columns — avoids pulling future secret columns via `select('*')`. */
const PROJECT_SESSION_COLUMNS = [
  'id',
  'name',
  'key',
  'description',
  'status',
  'owner_id',
  'start_date',
  'end_date',
  'pm_connection_id',
  'pm_external',
  'vc_connection_id',
  'vc_external',
  'logo_url',
  'cover_picture',
  'attributes_config',
  'workflow_config',
  'created_by',
  'created_at',
  'updated_by',
  'updated_at',
  'deleted_at',
].join(', ');

type ProjectRowWithSecrets = Project & {
  github_token?: string | null;
  pm_connection_id?: string | null;
  pm_external?: unknown;
  vc_connection_id?: string | null;
  vc_external?: unknown;
};

function sanitizeProjectRow(row: ProjectRowWithSecrets): Project {
  return mapProjectRowForWire(row) as Project;
}

/**
 * Supabase-js RSC reads (default). Skips the `web → api` hop; the facade in
 * `projects.reads.server.ts` picks this or the Express twin.
 */

export async function getProjectListPaginatedFromSupabase(
  page: number,
  limit: number,
  status?: ProjectStatusTab,
  search?: string
): Promise<GetProjectsPaginatedResponse> {
  const supabase = await createClient();
  const dbUser = await getDbUser();
  const accessibleIds = dbUser ? await listAccessibleProjectIds(dbUser.id) : [];

  if (accessibleIds.length === 0) {
    return {
      projects: [],
      ...paginationMeta(0, page, limit),
    };
  }

  let query = supabase
    .from('projects')
    .select(`${PROJECT_SESSION_COLUMNS}, ${OWNER_SELECT}`, { count: 'exact' });

  query = query.in('id', accessibleIds);

  if (status === ProjectStatusEnum.archived) {
    query = query.not('deleted_at', 'is', null);
  } else {
    query = query.is('deleted_at', null);
  }

  query = applyListSearch(query, search, ['name', 'key', 'description']);

  const { rows: projects, ...meta } = await runPaginatedSelect<Project>(
    query,
    page,
    limit,
    {
      orderBy: 'created_at',
      logLabel: 'failed to list projects paginated',
      errorMessage: 'Failed to list projects',
    }
  );

  const teamCounts = await getTeamCountsByProjectIds(projects.map((p) => p.id));

  return {
    projects: projects.map((project) => ({
      ...sanitizeProjectRow(project as ProjectRowWithSecrets),
      team_count: teamCounts[project.id] ?? 0,
    })),
    ...meta,
  };
}

export async function getProjectFromSupabase(id: string): Promise<Project> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('projects')
    .select(`${PROJECT_SESSION_COLUMNS}, ${OWNER_SELECT}`)
    .eq('id', id)
    .maybeSingle();

  throwIfError(error, 'failed to find project by id', 'Failed to find project');

  return sanitizeProjectRow(data as unknown as ProjectRowWithSecrets);
}

export async function getProjectMembersFromSupabase(
  projectId: string
): Promise<ProjectMemberWithUser[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('project_members')
    .select(`*, ${PROJECT_MEMBER_USER_SELECT}`)
    .eq('project_id', projectId)
    .eq('status', 'active');

  throwIfError(
    error,
    'failed to list project members',
    'Failed to list project members'
  );

  return filterActiveProjectMembersWithUser(data);
}

/** Count non-deleted teams per project for list badges. */
export async function getTeamCountsByProjectIds(
  projectIds: readonly string[]
): Promise<Record<string, number>> {
  const counts = zeroCountsById(projectIds);
  if (projectIds.length === 0) {
    return counts;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('teams')
    .select('project_id')
    .in('project_id', [...projectIds])
    .neq('status', 'deleted');

  throwIfError(
    error,
    'failed to count teams by project ids',
    'Failed to count project teams'
  );

  return aggregateCountsByKey(
    counts,
    (data ?? []).map((row) => row.project_id)
  );
}

function filterActiveProjectMembersWithUser(
  data: unknown
): ProjectMemberWithUser[] {
  return ((data ?? []) as ProjectMemberWithUser[]).filter(
    (member) => member.status === 'active' && member.user
  );
}

/** Batch read active project members for form dropdowns (e.g. team form).
 * Auth-gated admin read so the map matches the cached projects dropdown
 * and is not emptied by cookie-client RLS.
 */
export async function getProjectMembersByProjectIds(
  projectIds: string[]
): Promise<ProjectMembersByProjectId> {
  if (projectIds.length === 0) {
    return {};
  }

  const user = await getUser();
  if (!user) {
    return {};
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('project_members')
    .select(`*, ${PROJECT_MEMBER_USER_SELECT}`)
    .in('project_id', projectIds)
    .eq('status', 'active');

  throwIfError(
    error,
    'failed to list project members by project ids',
    'Failed to list project members'
  );

  const grouped: ProjectMembersByProjectId = Object.fromEntries(
    projectIds.map((projectId) => [projectId, []])
  );

  for (const member of filterActiveProjectMembersWithUser(data)) {
    const bucket = grouped[member.project_id];
    if (bucket) {
      bucket.push(member);
    }
  }

  return grouped;
}
