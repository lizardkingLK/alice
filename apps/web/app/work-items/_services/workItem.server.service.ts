import { DbUser } from '@/app/users/_services/users.service';
import { apiFetch as apiServerFetch } from '@/lib/api/api-client.server';

import { Tables } from '@repo/types';

export type DbWorkItem = Tables<'work_items'> & {
  assignee: Pick<DbUser, 'id' | 'name' | 'email'> | null;
};

const workItemsPath = '/api/workItems';

export async function getWorkItems(): Promise<DbWorkItem[]> {
  const data = await apiServerFetch<DbWorkItem[]>(workItemsPath);
  return data;
}
