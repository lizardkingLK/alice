import { apiFetch } from '@/lib/api/api-fetch.reads.use.server';
import { getDbUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { paginationMeta } from '@/lib/db/pagination';
import { applyListSearch, runPaginatedSelect } from '@/lib/db/query';
import { isAdmin } from '@/lib/rbac/roles';
import {
  createAccessRequestsService,
  type AccessRequestEntry,
  type AccessRequestListParams,
  type AccessRequestListResult,
} from './access-requests.mutations.shared';

const service = createAccessRequestsService(apiFetch);

const REQUEST_SEARCH_FIELDS = [
  'requester_email',
  'requester_name',
  'message',
] as const;

export async function listAccessRequests(
  params: AccessRequestListParams = {}
): Promise<AccessRequestListResult> {
  const { status = 'pending', page = 1, limit = 10, search } = params;

  const dbUser = await getDbUser();
  if (!isAdmin(dbUser?.role)) {
    return { items: [], ...paginationMeta(0, page, limit) };
  }

  const supabase = await createClient();
  let query = supabase.from('access_requests').select('*', { count: 'exact' });

  if (status !== 'all') {
    query = query.eq('status', status);
  }

  query = applyListSearch(query, search, [...REQUEST_SEARCH_FIELDS]);

  const { rows: items, ...meta } = await runPaginatedSelect<AccessRequestEntry>(
    query,
    page,
    limit,
    {
      orderBy: 'last_requested_at',
      ascending: false,
      logLabel: 'failed to list access requests',
      errorMessage: 'Failed to list access requests',
    }
  );

  return { items, ...meta };
}

export async function getAccessRequestById(
  id: string
): Promise<AccessRequestEntry | null> {
  const dbUser = await getDbUser();
  if (!isAdmin(dbUser?.role)) {
    return null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('access_requests')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('failed to load access request:', error.message);
    return null;
  }

  return data;
}

export const denyAccessRequest = service.denyAccessRequest;

export type {
  AccessRequestEntry,
  AccessRequestListParams,
  AccessRequestListResult,
} from './access-requests.mutations.shared';
