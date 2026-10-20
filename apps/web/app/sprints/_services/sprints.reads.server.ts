import { cache } from 'react';
import { shouldReadViaApi } from '@/lib/data-retrieval.server';
import type { PaginatedSprints, Sprint } from './sprints.mutations.client';
import {
  getSprintFromApi,
  listSprintsPaginatedFromApi,
} from './sprints.reads.api.server';
import {
  getSprintFromSupabase,
  listSprintsPaginatedFromSupabase,
} from './sprints.reads.supabase.server';
import type { GetSprintsPaginatedOptions } from './sprints.reads.types';

export type { GetSprintsPaginatedOptions } from './sprints.reads.types';

const EMPTY_PAGINATION = (
  page: number,
  limit: number
): PaginatedSprints['pagination'] => ({
  page,
  limit,
  totalCount: 0,
  totalPages: 1,
});

/**
 * Public server read facade — picks supabase-js (default) or Express GET
 * based on `DATA_READS_VIA_API`. Sprint mutations still go through the API.
 */
export async function getSprintsPaginatedServer(
  tab?: 'active' | 'archived',
  page: number = 1,
  limit: number = 5,
  search?: string,
  options?: GetSprintsPaginatedOptions
): Promise<PaginatedSprints> {
  const projectIds = options?.projectIds;
  const projectId = options?.projectId;

  if (projectIds?.length === 0) {
    return { sprints: [], pagination: EMPTY_PAGINATION(page, limit) };
  }

  if (projectId && projectIds && !projectIds.includes(projectId)) {
    return { sprints: [], pagination: EMPTY_PAGINATION(page, limit) };
  }

  if (shouldReadViaApi('sprints')) {
    return listSprintsPaginatedFromApi(tab, page, limit, search, projectId);
  }

  return listSprintsPaginatedFromSupabase(tab, page, limit, search, options);
}

export const getSprint = cache(
  async (sprintId: string): Promise<Sprint | null> => {
    if (shouldReadViaApi('sprints')) {
      return getSprintFromApi(sprintId);
    }

    return getSprintFromSupabase(sprintId);
  }
);
