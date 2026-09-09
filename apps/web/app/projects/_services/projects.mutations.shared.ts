/* eslint-disable no-unused-vars */
import { forceOptimisticPatch } from '@/lib/optimistic-lock/force-patch';
import type {
  Project,
  CreateProjectInput,
  UpdateProjectInput,
} from '@/app/projects/_types/projects.types';

export type {
  Project,
  GetProjectsPaginatedResponse,
  CreateProjectInput,
  UpdateProjectInput,
  ProjectMemberWithUser,
  ProjectMembersByProjectId,
} from '@/app/projects/_types/projects.types';

export function createProjectsService(
  apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>
) {
  const apiProjects = '/api/projects';

  return {
    async createProject(input: CreateProjectInput): Promise<Project> {
      const data = await apiFetch<{ project: Project }>(apiProjects, {
        method: 'POST',
        body: JSON.stringify(input),
      });
      return data.project;
    },

    async updateProject(
      id: string,
      input: UpdateProjectInput,
      expectedUpdatedAt: string
    ): Promise<Project> {
      const data = await apiFetch<{ project: Project }>(
        `${apiProjects}/${id}`,
        {
          method: 'PUT',
          body: JSON.stringify({ ...input, expectedUpdatedAt }),
        }
      );
      return data.project;
    },

    /** Force-apply pending fields after a user confirms Keep mine / merge. */
    async forceUpdateProject(
      id: string,
      pendingFields: Record<string, unknown>,
      expectedUpdatedAt: string
    ): Promise<Project> {
      const data = await forceOptimisticPatch<{ project: Project }>(
        apiFetch,
        `${apiProjects}/${id}`,
        { pendingFields, expectedUpdatedAt }
      );
      return data.project;
    },

    async softDeleteProject(
      id: string,
      expectedUpdatedAt: string
    ): Promise<Project> {
      const data = await apiFetch<{ project: Project }>(
        `${apiProjects}/${id}/soft-delete`,
        {
          method: 'PATCH',
          body: JSON.stringify({ expectedUpdatedAt }),
        }
      );
      return data.project;
    },

    async restoreProject(
      id: string,
      expectedUpdatedAt: string
    ): Promise<Project> {
      const data = await apiFetch<{ project: Project }>(
        `${apiProjects}/${id}/restore`,
        {
          method: 'PATCH',
          body: JSON.stringify({ expectedUpdatedAt }),
        }
      );
      return data.project;
    },

    async hardDeleteProject(id: string): Promise<void> {
      await apiFetch<void>(`${apiProjects}/${id}`, {
        method: 'DELETE',
      });
    },

    async addProjectMember(projectId: string, userId: string): Promise<void> {
      await apiFetch<void>(`${apiProjects}/${projectId}/members`, {
        method: 'POST',
        body: JSON.stringify({ userId }),
      });
    },

    async removeProjectMember(
      projectId: string,
      userId: string
    ): Promise<void> {
      await apiFetch<void>(`${apiProjects}/${projectId}/members/${userId}`, {
        method: 'DELETE',
      });
    },

    async updateProjectFieldsConfig(
      projectId: string,
      attributes_config: unknown
    ): Promise<Project> {
      const data = await apiFetch<{ project: Project }>(
        `${apiProjects}/${projectId}`,
        {
          method: 'PUT',
          body: JSON.stringify({ attributes_config }),
        }
      );
      return data.project;
    },
  };
}
