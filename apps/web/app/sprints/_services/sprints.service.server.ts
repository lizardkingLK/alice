import { apiFetch } from '@/lib/api/api-client.server';
import { PaginatedSprints } from './sprints.service';

const apiSprints = '/api/sprints';

export async function getSprintsPaginatedServer(
  tab?: 'active' | 'archived',
  page?: number,
  limit?: number
): Promise<PaginatedSprints> {
  const params = new URLSearchParams();
  if (tab) params.append('status', tab);
  if (page) params.append('page', page.toString());
  if (limit) params.append('limit', limit.toString());

  return apiFetch<PaginatedSprints>(`${apiSprints}?${params.toString()}`, {
    next: { revalidate: 0 },
  });
}
