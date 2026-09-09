import { apiFetch } from '@/lib/api/api-fetch.mutations.use.client';
import { createProjectsService } from '@/app/projects/_services/projects.mutations.shared';

const service = createProjectsService(apiFetch);

export const createProject = service.createProject;
export const updateProject = service.updateProject;
export const forceUpdateProject = service.forceUpdateProject;
export const softDeleteProject = service.softDeleteProject;
export const restoreProject = service.restoreProject;
export const hardDeleteProject = service.hardDeleteProject;
export const addProjectMember = service.addProjectMember;
export const removeProjectMember = service.removeProjectMember;
export const updateProjectFieldsConfig = service.updateProjectFieldsConfig;

export type {
  Project,
  DbProject,
  GetProjectsPaginatedResponse,
  CreateProjectInput,
  UpdateProjectInput,
  ProjectMemberWithUser,
  ProjectMembersByProjectId,
} from '@/app/projects/_types/projects.types';
