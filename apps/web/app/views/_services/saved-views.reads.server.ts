import { shouldReadViaApi } from '@/lib/data-retrieval.server';
import type { ViewsListTab } from '@/lib/search-params';
import { getSavedViewsPaginatedFromApi } from './saved-views.reads.api.server';
import { getSavedViewsPaginatedFromSupabase } from './saved-views.reads.supabase.server';
import type { GetSavedViewsPaginatedResponse } from './saved-views.reads.types';

export type {
  GetSavedViewsPaginatedResponse,
  SavedView,
} from './saved-views.reads.types';

/**
 * Public server read facade — picks supabase-js (default) or Express GET
 * based on `DATA_READS_VIA_API`. Mutations go through `/api/saved-views`.
 */
export async function getSavedViewsPaginated(
  page: number,
  limit: number,
  tab: ViewsListTab,
  search?: string
): Promise<GetSavedViewsPaginatedResponse> {
  if (shouldReadViaApi('saved-views')) {
    return getSavedViewsPaginatedFromApi(page, limit, tab, search);
  }

  return getSavedViewsPaginatedFromSupabase(page, limit, tab, search);
}
