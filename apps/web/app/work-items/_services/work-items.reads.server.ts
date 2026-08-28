import { cache } from 'react';
import {
  getWorkItemFromApi,
  listWorkItemsPaginatedFromApi,
} from '@/app/work-items/_services/reads/api.server';
import {
  getWorkItemAncestorsFromSupabase,
  getWorkItemFromSupabase,
  getWorkItemsFromSupabase,
  listWorkItemsPaginatedFromSupabase,
} from '@/app/work-items/_services/reads/supabase.server';
import type {
  DbWorkItem,
  GetWorkItemsOptions,
  GetWorkItemsPaginatedResponse,
  WorkItemAncestor,
  WorkItemListFilters,
} from '@/app/work-items/_types/work-items.reads.types';
import { shouldReadViaApi } from '@/lib/data-retrieval.server';

export type {
  DbWorkItem,
  GetWorkItemsOptions,
  GetWorkItemsPaginatedResponse,
  WorkItemAncestor,
  WorkItemListFilters,
} from '@/app/work-items/_types/work-items.reads.types';

export { applyWorkItemFilters } from '@/app/work-items/_services/reads/supabase.server';

/**
 * Public server read facade — picks supabase-js (default) or Express GET
 * based on `DATA_READS_VIA_API`. Mutations use `work-items.mutations.client.ts`.
 */
export async function getWorkItems(
  filters?: WorkItemListFilters,
  options?: GetWorkItemsOptions
): Promise<DbWorkItem[]> {
  // Unpaginated list is still Supabase-only (calendar / board / sprint report).
  return getWorkItemsFromSupabase(filters, options);
}

export async function getWorkItemsPaginated(
  page: number,
  limit: number,
  search?: string,
  filters?: WorkItemListFilters
): Promise<GetWorkItemsPaginatedResponse> {
  if (shouldReadViaApi('work-items')) {
    return listWorkItemsPaginatedFromApi(page, limit, search, filters);
  }

  return listWorkItemsPaginatedFromSupabase(page, limit, search, filters);
}

export const getWorkItem = cache(
  async (workItemId: string): Promise<DbWorkItem | null> => {
    if (shouldReadViaApi('work-items')) {
      return getWorkItemFromApi(workItemId);
    }

    return getWorkItemFromSupabase(workItemId);
  }
);

/**
 * Walk `parent_id` upward and return ancestors root-first
 * (Epic → … → immediate parent). Caps at hierarchy depth.
 */
export async function getWorkItemAncestors(
  parentId: string | null | undefined
): Promise<WorkItemAncestor[]> {
  return getWorkItemAncestorsFromSupabase(parentId);
}
