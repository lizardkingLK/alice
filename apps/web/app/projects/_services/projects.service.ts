import { apiFetch } from '@/lib/api/api-client';
import { createProjectsService } from './projects.service.base';

const service = createProjectsService(apiFetch);

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
