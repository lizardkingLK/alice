import { apiFetch } from '@/lib/api/api-fetch.reads.use.server';
import { getCachedProjectList } from '@/lib/cache/dropdown-cache';
import { shouldReadViaApi } from '@/lib/data-retrieval.server';
import type { ProjectStatusTab } from '@/app/projects/_helpers/project-status';
import {
  getProjectFromApi,
  getProjectListPaginatedFromApi,
  getProjectMembersFromApi,
} from '@/app/projects/_services/projects.reads.api.server';
import {
  getProjectFromSupabase,
  getProjectListPaginatedFromSupabase,
  getProjectMembersFromSupabase,
} from '@/app/projects/_services/projects.reads.supabase.server';
import { createProjectsService } from '@/app/projects/_services/projects.mutations.shared';
import type {
  GetProjectsPaginatedResponse,
  Project,
  ProjectMemberWithUser,
} from '@/app/projects/_services/projects.mutations.shared';

const service = createProjectsService(apiFetch);

export {
  getProjectMembersByProjectIds,
  getTeamCountsByProjectIds,
} from '@/app/projects/_services/projects.reads.supabase.server';

/**
 * Public server read facade — picks supabase-js (default) or Express GET
 * based on `DATA_READS_VIA_API`. Mutations go through the API (`service`).
 */

/**
 * Projects for form dropdowns. Shared across requests via `unstable_cache`
 * (see `lib/cache/dropdown-cache.ts`); invalidated on project mutations
 * with `updateTag`. Supabase-only (no Express twin).
 */
export async function getProjectList(): Promise<Project[]> {
  return (await getCachedProjectList()) as Project[];
}

export async function getProjectListPaginated(
  page: number,
  limit: number,
  status?: ProjectStatusTab,
  search?: string
): Promise<GetProjectsPaginatedResponse> {
  if (shouldReadViaApi('projects')) {
    return getProjectListPaginatedFromApi(page, limit, status, search);
  }

  return getProjectListPaginatedFromSupabase(page, limit, status, search);
}

export async function getProjectDetails(id: string): Promise<Project> {
  if (shouldReadViaApi('projects')) {
    return getProjectFromApi(id);
  }

  return getProjectFromSupabase(id);
}

/** Alias for `getProjectDetails` (same Express / Supabase twin). */
export const getProject = getProjectDetails;

export async function getProjectMembers(
  projectId: string
): Promise<ProjectMemberWithUser[]> {
  if (shouldReadViaApi('projects')) {
    return getProjectMembersFromApi(projectId);
  }

  return getProjectMembersFromSupabase(projectId);
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
} from '@/app/projects/_services/projects.mutations.shared';
