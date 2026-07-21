import { User as DbUser } from '@/app/users/_services/users.service';
import { apiFetch as apiServerFetch } from '@/lib/api/api-client.server';
import { Tables } from '@repo/types';
import { ResponseDTO } from '@repo/types/connection';

type DbUserEssentials = Pick<DbUser, 'id' | 'name' | 'email'>;

export type DbWorkItem = Tables<'work_items'> & {
  assignee: DbUserEssentials | null;
  reporter?: DbUserEssentials | null;
};

export type GetWorkItemsPaginatedResponse = {
  workItems: DbWorkItem[];
  totalCount: number;
  page: number;
  limit: number;
  totalPages: number;
};

const workItemsPath = '/api/workItems';

export async function getWorkItems(filters?: { sprintId?: string | null }): Promise<DbWorkItem[]> {
  const params = new URLSearchParams();
  if (filters) {
    if (filters.sprintId === null) {
      params.set('sprint_id', 'null');
    } else if (filters.sprintId) {
      params.set('sprint_id', filters.sprintId);
    }
  }

  const queryString = params.toString();
  const url = queryString ? `${workItemsPath}?${queryString}` : workItemsPath;

  const response =
    await apiServerFetch<ResponseDTO<DbWorkItem[]>>(url);
  if (response.error) {
    throw new Error(response.error as string);
  }

  return response.data as DbWorkItem[];
}

export async function getWorkItemsPaginated(
  page: number,
  limit: number,
  search?: string,
  filters?: { sprintId?: string | null }
): Promise<GetWorkItemsPaginatedResponse> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });

  if (search?.trim()) {
    params.set('search', search.trim());
  }

  if (filters) {
    if (filters.sprintId === null) {
      params.set('sprint_id', 'null');
    } else if (filters.sprintId) {
      params.set('sprint_id', filters.sprintId);
    }
  }

  return apiServerFetch<GetWorkItemsPaginatedResponse>(
    `${workItemsPath}?${params.toString()}`
  );
}

export async function getWorkItem(workItemId: string): Promise<DbWorkItem> {
  const response = await apiServerFetch<ResponseDTO<DbWorkItem>>(
    `${workItemsPath}/${workItemId}`
  );
  if (response.error) {
    throw new Error(response.error as string);
  }

  return response.data as DbWorkItem;
}
