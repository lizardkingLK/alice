import { apiFetch } from '@/lib/api/api-fetch.reads.use.server';
import { asIso } from '@/lib/api/wire-date';
import type { ViewsListTab } from '@/lib/search-params';
import type {
  GetSavedViewsPaginatedResponse,
  SavedView,
} from './saved-views.reads.types';

/** Align Express JSON (ISO timestamps) with the PostgREST `saved_views` row shape. */
export function mapSavedViewApiRow(row: Record<string, unknown>): SavedView {
  return {
    ...row,
    created_at: asIso(row.created_at),
    updated_at: asIso(row.updated_at),
  } as unknown as SavedView;
}

/** Query string for `GET /api/saved-views` (matches `listSavedViewsQuerySchema`). */
export function buildSavedViewsListSearchParams(input: {
  page: number;
  limit: number;
  tab: ViewsListTab;
  search?: string;
}): URLSearchParams {
  const params = new URLSearchParams();
  params.set('page', String(input.page));
  params.set('limit', String(input.limit));
  params.set('tab', input.tab);

  const search = input.search?.trim();
  if (search) {
    params.set('search', search);
  }

  return params;
}

type SavedViewsListApiResponse = Omit<
  GetSavedViewsPaginatedResponse,
  'views'
> & {
  views: Record<string, unknown>[];
};

/** Optional RSC read path via Express GET (`DATA_READS_VIA_API` toggle). */
export async function getSavedViewsPaginatedFromApi(
  page: number,
  limit: number,
  tab: ViewsListTab,
  search?: string
): Promise<GetSavedViewsPaginatedResponse> {
  const params = buildSavedViewsListSearchParams({
    page,
    limit,
    tab,
    search,
  });
  const result = await apiFetch<SavedViewsListApiResponse>(
    `/api/saved-views?${params.toString()}`
  );

  return {
    views: result.views.map(mapSavedViewApiRow),
    totalCount: result.totalCount,
    page: result.page,
    limit: result.limit,
    totalPages: result.totalPages,
  };
}
