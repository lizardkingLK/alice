import { DbUser } from '@/app/users/_services/users.service';
import { apiFetch } from '@/lib/api/api-client.server';
import { Tables } from '@repo/types';

export type DbProject = Tables<'projects'> & {
  owner?: Pick<DbUser, 'id' | 'name' | 'email'> | null;
};

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

export type CreateProjectInput = Omit<
  Tables<'projects'>,
  | 'id'
  | 'created_at'
  | 'updated_at'
  | 'deleted_at'
  | 'created_by'
  | 'updated_by'
  | 'work'
  | 'attributes_config'
  | 'workflow_config'
>;

export type UpdateProjectInput = Partial<CreateProjectInput>;

export async function createProject(
  input: CreateProjectInput
): Promise<Tables<'projects'>> {
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
  const data = await apiFetch<{ project: Tables<'projects'> }>(
    `${apiProjects}/${id}`,
    {
      method: 'PUT',
      body: JSON.stringify(input),
    }
  );
  return data.project;
}

export async function softDeleteProject(
  id: string
): Promise<Tables<'projects'>> {
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
