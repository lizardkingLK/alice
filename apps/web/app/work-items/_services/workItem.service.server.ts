import { cache } from 'react';
import { shouldReadViaApi } from '@/lib/data-retrieval.server';
import {
  getWorkItemFromApi,
  listWorkItemsPaginatedFromApi,
} from '@/app/work-items/_services/workItem.service.server.api';
import {
  applyWorkItemFilters,
  getWorkItemAncestorsFromSupabase,
  getWorkItemFromSupabase,
  getWorkItemsFromSupabase,
  listWorkItemsPaginatedFromSupabase,
} from '@/app/work-items/_services/workItem.service.server.supabase';
import type {
  DbWorkItem,
  GetWorkItemsOptions,
  GetWorkItemsPaginatedResponse,
  WorkItemAncestor,
  WorkItemListFilters,
} from '@/app/work-items/_services/workItem.service.server.types';

export type {
  DbWorkItem,
  GetWorkItemsOptions,
  GetWorkItemsPaginatedResponse,
  WorkItemAncestor,
  WorkItemListFilters,
} from '@/app/work-items/_services/workItem.service.server.types';

export { applyWorkItemFilters } from '@/app/work-items/_services/workItem.service.server.supabase';
/**
 * Strategy facade for server-only work-item reads.
 * Mutations still go through the API (`workItem.service.client.ts`).
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
