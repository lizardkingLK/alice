import {
  SAVED_VIEW_LIST_SEARCH_FIELDS,
  uniqueSavedViewIdsFromShares,
  type Tables,
} from '@repo/types';
import { getUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { pageRange, paginationMeta } from '@/lib/db/pagination';
import { applyListSearch, throwIfError } from '@/lib/db/query';
import type { ViewsListTab } from '@/lib/search-params';

export type SavedView = Tables<'saved_views'>;

export type GetSavedViewsPaginatedResponse = {
  readonly views: SavedView[];
  readonly totalCount: number;
  readonly page: number;
  readonly limit: number;
  readonly totalPages: number;
};

/**
 * Reads saved views directly from Supabase in RSC (skip web → api hop).
 * Mutations still go through `/api/saved-views`.
 *
 * Shared tab filters must stay aligned with API `listSharedWithMe`
 * (active shares → unique view ids → active views). This reader adds
 * search + pagination on top of that shared filter shape.
 */
export async function getSavedViewsPaginated(
  page: number,
  limit: number,
  tab: ViewsListTab,
  search?: string
): Promise<GetSavedViewsPaginatedResponse> {
  const user = await getUser();
  if (!user) {
    return { views: [], ...paginationMeta(0, page, limit) };
  }

  const supabase = await createClient();
  const { from, to } = pageRange(page, limit);

  if (tab === 'shared') {
    const { data: shares, error: sharesError } = await supabase
      .from('saved_view_shares')
      .select('view_id')
      .eq('user_id', user.id)
      .eq('status', 'active');

    throwIfError(
      sharesError,
      'failed to list saved view shares',
      'Failed to list shared views'
    );

    const viewIds = uniqueSavedViewIdsFromShares(shares ?? []);
    if (viewIds.length === 0) {
      return { views: [], ...paginationMeta(0, page, limit) };
    }

    let query = supabase
      .from('saved_views')
      .select('*', { count: 'exact' })
      .in('id', viewIds)
      .eq('status', 'active');

    query = applyListSearch(query, search, [...SAVED_VIEW_LIST_SEARCH_FIELDS]);

    const { data, error, count } = await query
      .order('updated_at', { ascending: false })
      .range(from, to);

    throwIfError(
      error,
      'failed to list shared saved views',
      'Failed to list shared views'
    );

    return {
      views: (data ?? []) as SavedView[],
      ...paginationMeta(count ?? 0, page, limit),
    };
  }

  const status = tab === 'archived' ? 'archived' : 'active';
  let query = supabase
    .from('saved_views')
    .select('*', { count: 'exact' })
    .eq('owner_id', user.id)
    .eq('status', status);

  query = applyListSearch(query, search, [...SAVED_VIEW_LIST_SEARCH_FIELDS]);

  const { data, error, count } = await query
    .order('updated_at', { ascending: false })
    .range(from, to);

  throwIfError(
    error,
    'failed to list owned saved views',
    'Failed to list saved views'
  );

  return {
    views: (data ?? []) as SavedView[],
    ...paginationMeta(count ?? 0, page, limit),
  };
}
