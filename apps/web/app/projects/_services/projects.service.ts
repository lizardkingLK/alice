import { apiFetch } from '@/lib/api/api-client.server';
import { Tables } from '@repo/types';

type DbUser = Tables<'users'>;

export type ProjectListRow = Tables<'projects'> & {
  owner?: Pick<DbUser, 'id' | 'name' | 'email'> | null;
};

const apiProjects = '/api/projects';

export async function getProjectList(): Promise<ProjectListRow[]> {
  const data = await apiFetch<{ projects: ProjectListRow[] }>(apiProjects, {
    next: { revalidate: 0 },
  });
  return data.projects;
}

export type GetProjectsPaginatedResponse = {
  projects: ProjectListRow[];
  totalCount: number;
  page: number;
  limit: number;
  totalPages: number;
};

export async function getProjectListPaginated(
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
  const data = await apiFetch<GetProjectsPaginatedResponse>(url, {
    next: { revalidate: 0 },
  });
  return data;
}

export type CreateProjectInput = Omit<
  Tables<'projects'>,
  'id' | 'created_at' | 'updated_at' | 'deleted_at' | 'created_by' | 'updated_by'
>;

export type UpdateProjectInput = Partial<CreateProjectInput>;

export async function createProject(input: CreateProjectInput): Promise<Tables<'projects'>> {
  const data = await apiFetch<{ project: Tables<'projects'> }>(apiProjects, {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return data.project;
}

export async function updateProject(
  id: string,
  input: UpdateProjectInput
): Promise<Tables<'projects'>> {
  const data = await apiFetch<{ project: Tables<'projects'> }>(`${apiProjects}/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
  return data.project;
}

export async function softDeleteProject(id: string): Promise<Tables<'projects'>> {
  const data = await apiFetch<{ project: Tables<'projects'> }>(
    `${apiProjects}/${id}/soft-delete`,
    {
      method: 'PATCH',
    }
  );
  return data.project;
}

export async function restoreProject(id: string): Promise<Tables<'projects'>> {
  const data = await apiFetch<{ project: Tables<'projects'> }>(
    `${apiProjects}/${id}/restore`,
    {
      method: 'PATCH',
    }
  );
  return data.project;
}

export async function hardDeleteProject(id: string): Promise<void> {
  await apiFetch<void>(`${apiProjects}/${id}`, {
    method: 'DELETE',
  });
}
