import { apiFetch } from '@/lib/api/api-client.server';
import { createClient } from '@/lib/supabase/server';
import { pageRange, paginationMeta } from '@/lib/db/pagination';
import { createProjectsService } from './projects.service.base';
import type {
  GetProjectsPaginatedResponse,
  Project,
  ProjectMemberWithUser,
} from './projects.service.base';

const service = createProjectsService(apiFetch);

const OWNER_SELECT = 'owner:users!projects_owner_id_fkey(id, name, email)';

/**
 * Reads query Supabase directly from the RSC layer to skip the `web → api`
 * hop. Mutations still go through the API.
 */

export async function getProjectList(): Promise<Project[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('projects')
    .select(`*, ${OWNER_SELECT}`)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('error. failed to list projects:', error.message);
    throw new Error('Failed to list projects');
  }

  return (data ?? []) as unknown as Project[];
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

  if (search) {
    const sanitized = `%${search}%`;
    query = query.or(
      `name.ilike.${sanitized},key.ilike.${sanitized},description.ilike.${sanitized}`
    );
  }

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) {
    console.error('error. failed to list projects paginated:', error.message);
    throw new Error('Failed to list projects');
  }

  return {
    projects: (data ?? []) as unknown as Project[],
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

  if (error) {
    console.error('error. failed to find project by id:', error.message);
    throw new Error('Failed to find project');
  }

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
    .select('*, user:users!project_members_user_id_fkey(id, name, email, role)')
    .eq('project_id', projectId)
    .eq('status', 'active');

  if (error) {
    console.error('error. failed to list project members:', error.message);
    throw new Error('Failed to list project members');
  }

  return (data ?? []) as unknown as ProjectMemberWithUser[];
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
} from './projects.service.base';
