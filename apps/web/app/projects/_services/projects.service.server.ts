import { USER_PROJECTION_WITH_ROLE, userRelationSelect } from '@repo/types';
import { apiFetch } from '@/lib/api/api-client.server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getUser } from '@/lib/auth';
import { pageRange, paginationMeta } from '@/lib/db/pagination';
import { applyListSearch, throwIfError } from '@/lib/db/query';
import { getCachedProjectList } from '@/lib/cache/dropdown-cache';
import { createProjectsService } from './projects.service.base';
import type {
  GetProjectsPaginatedResponse,
  Project,
  ProjectMemberWithUser,
  ProjectMembersByProjectId,
} from './projects.service.base';

const service = createProjectsService(apiFetch);

const OWNER_SELECT = 'owner:users!projects_owner_id_fkey(id, name, email)';
const PROJECT_MEMBER_USER_SELECT = userRelationSelect(
  'user',
  'project_members_user_id_fkey',
  USER_PROJECTION_WITH_ROLE
);

/**
 * Reads query Supabase directly from the RSC layer to skip the `web → api`
 * hop. Mutations still go through the API.
 */

/**
 * Projects for form dropdowns. Shared across requests via `unstable_cache`
 * (see `lib/cache/dropdown-cache.ts`); invalidated on project mutations
 * with `updateTag`.
 */
export async function getProjectList(): Promise<Project[]> {
  return (await getCachedProjectList()) as Project[];
}

export async function getProjectListPaginated(
  page: number,
  limit: number,
  status?: 'active' | 'archived',
  search?: string
): Promise<GetProjectsPaginatedResponse> {
  const supabase = await createClient();
  const { from, to } = pageRange(page, limit);

  let query = supabase
    .from('projects')
    .select(`*, ${OWNER_SELECT}`, { count: 'exact' });

  if (status === 'archived') {
    query = query.not('deleted_at', 'is', null);
  } else {
    query = query.is('deleted_at', null);
  }

  query = applyListSearch(query, search, ['name', 'key', 'description']);

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(from, to);

  throwIfError(
    error,
    'failed to list projects paginated',
    'Failed to list projects'
  );

  const projects = (data ?? []) as unknown as Project[];
  const teamCounts = await getTeamCountsByProjectIds(projects.map((p) => p.id));

  return {
    projects: projects.map((project) => ({
      ...project,
      team_count: teamCounts[project.id] ?? 0,
    })),
    ...paginationMeta(count ?? 0, page, limit),
  };
}

async function findProjectById(id: string): Promise<Project> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('projects')
    .select(`*, ${OWNER_SELECT}`)
    .eq('id', id)
    .maybeSingle();

  throwIfError(error, 'failed to find project by id', 'Failed to find project');

  return data as unknown as Project;
}

export async function getProjectDetails(id: string): Promise<Project> {
  return findProjectById(id);
}

export async function getProject(id: string): Promise<Project> {
  return findProjectById(id);
}

export async function getProjectMembers(
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
  if (projectIds.length === 0) {
    return {};
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

  const counts = Object.fromEntries(projectIds.map((id) => [id, 0]));
  for (const row of data ?? []) {
    if (!row.project_id) {
      continue;
    }
    counts[row.project_id] = (counts[row.project_id] ?? 0) + 1;
  }

  return counts;
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

export const createProject = service.createProject;
export const updateProject = service.updateProject;
export const softDeleteProject = service.softDeleteProject;
export const restoreProject = service.restoreProject;
export const hardDeleteProject = service.hardDeleteProject;
export const addProjectMember = service.addProjectMember;
export const removeProjectMember = service.removeProjectMember;

export type {
  Project,
  GetProjectsPaginatedResponse,
  CreateProjectInput,
  UpdateProjectInput,
  ProjectMemberWithUser,
  ProjectMembersByProjectId,
} from './projects.service.base';
