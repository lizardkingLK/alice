/* eslint-disable no-unused-vars */
import { Tables } from '@repo/types';
import type { User } from '@/app/users/_services/users.service';

export type Project = Tables<'projects'> & {
  owner?: Pick<User, 'id' | 'name' | 'email'> | null;
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
>;

export type UpdateProjectInput = Partial<CreateProjectInput>;

export type ProjectMemberWithUser = {
  project_id: string;
  user_id: string;
  status: 'active' | 'inactive' | 'archived' | 'deleted';
  created_at: string;
  user: Pick<User, 'id' | 'name' | 'email' | 'role'> | null;
};

export function createProjectsService(
  apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>
) {
  const apiProjects = '/api/projects';

  return {
    async getProjectList(): Promise<Project[]> {
      const data = await apiFetch<{ projects: Project[] }>(apiProjects);
      return data.projects;
    },

    async getProjectListPaginated(
      page: number,
      limit: number,
      status?: 'active' | 'archived',
      search?: string
    ): Promise<GetProjectsPaginatedResponse> {
      let url = `${apiProjects}?page=${page}&limit=${limit}`;
      if (status) {
        url += `&status=${status}`;
      }
      if (search) {
        url += `&search=${encodeURIComponent(search)}`;
      }
      return apiFetch<GetProjectsPaginatedResponse>(url);
    },

    async createProject(
      input: CreateProjectInput
    ): Promise<Tables<'projects'>> {
      const data = await apiFetch<{ project: Tables<'projects'> }>(
        apiProjects,
        {
          method: 'POST',
          body: JSON.stringify(input),
        }
      );
      return data.project;
    },

    async updateProject(
      id: string,
      input: UpdateProjectInput
    ): Promise<Tables<'projects'>> {
      const data = await apiFetch<{ project: Tables<'projects'> }>(
        `${apiProjects}/${id}`,
        {
          method: 'PUT',
          body: JSON.stringify(input),
        }
      );
      return data.project;
    },

    async softDeleteProject(id: string): Promise<Tables<'projects'>> {
      const data = await apiFetch<{ project: Tables<'projects'> }>(
        `${apiProjects}/${id}/soft-delete`,
        {
          method: 'PATCH',
        }
      );
      return data.project;
    },

    async restoreProject(id: string): Promise<Tables<'projects'>> {
      const data = await apiFetch<{ project: Tables<'projects'> }>(
        `${apiProjects}/${id}/restore`,
        {
          method: 'PATCH',
        }
      );
      return data.project;
    },

    async hardDeleteProject(id: string): Promise<void> {
      await apiFetch<void>(`${apiProjects}/${id}`, {
        method: 'DELETE',
      });
    },

    async getProjectDetails(id: string): Promise<Project> {
      const data = await apiFetch<{ project: Project }>(`${apiProjects}/${id}`);
      return data.project;
    },

    async getProject(id: string): Promise<Project> {
      const data = await apiFetch<{ project: Project }>(`${apiProjects}/${id}`);
      return data.project;
    },

    async getProjectMembers(
      projectId: string
    ): Promise<ProjectMemberWithUser[]> {
      const data = await apiFetch<{ members: ProjectMemberWithUser[] }>(
        `${apiProjects}/${projectId}/members`
      );
      return data.members;
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
