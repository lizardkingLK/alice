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

export type CreateProjectAccepted = {
  readonly accepted: true;
  readonly message: string;
  readonly correlationId: string;
};

export function createProjectsService(
  apiFetch: <T>(
    path: string,
    init?: RequestInit & { skipDatabaseBusyRetry?: boolean }
  ) => Promise<T>
) {
  const apiProjects = '/api/projects';

  return {
    /** Fire-and-forget create — API returns 202; inbox notifies when ready. */
    async createProject(
      input: CreateProjectInput
    ): Promise<CreateProjectAccepted> {
      return await apiFetch<CreateProjectAccepted>(apiProjects, {
        method: 'POST',
        body: JSON.stringify(input),
        skipDatabaseBusyRetry: true,
      });
    },

    async updateProject(
      id: string,
      input: UpdateProjectInput,
      expectedUpdatedAt: string
    ): Promise<Project> {
      const data = await apiFetch<{
        project: Project;
        typeRemoval?: {
          detachedCount: number;
          deletedCount: number;
          migratedCount: number;
        };
      }>(`${apiProjects}/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ ...input, expectedUpdatedAt }),
      });
      return data.project;
    },

    async previewWorkItemTypeRemoval(
      id: string,
      removedTypes: string[],
      keptTypes: string[]
    ): Promise<
      import('@repo/types/api/v1').WorkItemTypeRemovalPreviewResponse
    > {
      const params = new URLSearchParams({
        removeTypes: removedTypes.join(','),
        keepTypes: keptTypes.join(','),
      });
      return await apiFetch(
        `${apiProjects}/${id}/work-item-type-removal-preview?${params.toString()}`
      );
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
      attributes_config: unknown,
      expectedUpdatedAt?: string
    ): Promise<Project> {
      const payload: Record<string, unknown> = { attributes_config };
      if (expectedUpdatedAt !== undefined) {
        payload.expectedUpdatedAt = expectedUpdatedAt;
      }
      const data = await apiFetch<{ project: Project }>(
        `${apiProjects}/${projectId}`,
        {
          method: 'PUT',
          body: JSON.stringify(payload),
        }
      );
      return data.project;
    },
  };
}
