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
