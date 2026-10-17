import { apiFetch } from '@/lib/api/api-fetch.reads.use.server';
import type { GetTeamsPaginatedResponse } from './teams.mutations.shared';

/** Query string for `GET /api/teams` (matches `listTeamsQuerySchema`). */
export function buildTeamsListSearchParams(input: {
  page: number;
  limit: number;
  status?: 'active' | 'inactive' | 'archived' | 'deleted';
  search?: string;
  projectId?: string;
}): URLSearchParams {
  const params = new URLSearchParams();
  params.set('page', String(input.page));
  params.set('limit', String(input.limit));

  if (input.status) {
    params.set('status', input.status);
  }

  const search = input.search?.trim();
  if (search) {
    params.set('search', search);
  }

  if (input.projectId) {
    params.set('projectId', input.projectId);
  }

  return params;
}

/**
 * Optional RSC read path via Express GET (`DATA_READS_VIA_API` toggle).
 * Express serializes timestamps as ISO strings, which already match `Team`.
 */
export async function listTeamsPaginatedFromApi(
  page: number,
  limit: number,
  status?: 'active' | 'inactive' | 'archived' | 'deleted',
  search?: string,
  projectId?: string
): Promise<GetTeamsPaginatedResponse> {
  const params = buildTeamsListSearchParams({
    page,
    limit,
    status,
    search,
    projectId,
  });

  return apiFetch<GetTeamsPaginatedResponse>(`/api/teams?${params.toString()}`);
}
