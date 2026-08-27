/* eslint-disable no-unused-vars */
import { Tables } from '@repo/types';
import type { User } from '@/app/users/_services/users.service';
import { forceOptimisticPatch } from '@/lib/optimistic-lock/force-patch';

export type Project = Omit<Tables<'projects'>, 'github_token'> & {
  owner?: Pick<User, 'id' | 'name' | 'email'> | null;
  /** Active engineering teams scoped to this project (list views). */
  team_count?: number;
  /** True when a GitHub PAT is stored server-side (value never returned). */
  has_github_token?: boolean;
};

export type GetProjectsPaginatedResponse = {
  projects: Project[];
  totalCount: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type CreateProjectInput = Omit<
  Tables<'projects'>,
  | 'id'
  | 'created_at'
  | 'updated_at'
  | 'deleted_at'
  | 'created_by'
  | 'updated_by'
  | 'jira_connection_id'
  | 'jira_project_key'
  | 'github_repo'
  | 'github_token'
  | 'logo_url'
  | 'cover_picture'
> & {
  jira_connection_id?: string | null;
  jira_project_key?: string | null;
  github_repo?: string | null;
  /** Write-only; omit on edit when blank to leave existing PAT unchanged. */
  github_token?: string | null;
  logo_url?: string | null;
  cover_picture?: string | null;
};

export type UpdateProjectInput = Partial<CreateProjectInput>;

export type ProjectMemberWithUser = {
  project_id: string;
  user_id: string;
  status: 'active' | 'inactive' | 'archived' | 'deleted';
  created_at: string;
  user:
    | (Pick<User, 'id' | 'name' | 'email' | 'role'> & {
        profile_picture?: string | null;
      })
    | null;
};

/** Prefetched project → active members map for form UIs (e.g. team form). */
export type ProjectMembersByProjectId = Record<string, ProjectMemberWithUser[]>;

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
  };
}
