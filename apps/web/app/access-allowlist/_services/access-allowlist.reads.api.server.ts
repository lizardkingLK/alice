import { RecordStatusEnum } from '@repo/types';
import { apiFetch } from '@/lib/api/api-fetch.reads.use.server';
import { asIso, asNullableIso } from '@/lib/api/wire-date';
import type {
  AccessAllowlistEntry,
  AccessAllowlistListParams,
  AccessAllowlistListResult,
} from './access-allowlist.mutations.shared';

/** Align Express JSON (ISO timestamps) with the PostgREST `access_allowlist` row shape. */
export function mapAccessAllowlistApiRow(
  row: Record<string, unknown>
): AccessAllowlistEntry {
  return {
    ...row,
    created_at: asIso(row.created_at),
    updated_at: asIso(row.updated_at),
    expires_at: asNullableIso(row.expires_at),
  } as unknown as AccessAllowlistEntry;
}

/** Query string for `GET /api/access-allowlist` (matches `listAccessAllowlistQuerySchema`). */
export function buildAccessAllowlistListSearchParams(
  params: AccessAllowlistListParams = {}
): URLSearchParams {
  const {
    status = RecordStatusEnum.active,
    page = 1,
    limit = 10,
    search,
  } = params;
  const query = new URLSearchParams();
  query.set('page', String(page));
  query.set('limit', String(limit));
  query.set('status', status);

  const trimmedSearch = search?.trim();
  if (trimmedSearch) {
    query.set('search', trimmedSearch);
  }

  return query;
}

type AccessAllowlistListApiResponse = Omit<
  AccessAllowlistListResult,
  'items'
> & {
  items: Record<string, unknown>[];
};

/**
 * Optional RSC read path via Express GET (`DATA_READS_VIA_API` toggle).
 * Express is admin-gated and answers 403 for non-admins.
 */
export async function listAccessAllowlistFromApi(
  params: AccessAllowlistListParams = {}
): Promise<AccessAllowlistListResult> {
  const query = buildAccessAllowlistListSearchParams(params);
  const result = await apiFetch<AccessAllowlistListApiResponse>(
    `/api/access-allowlist?${query.toString()}`
  );

  return {
    items: result.items.map(mapAccessAllowlistApiRow),
    totalCount: result.totalCount,
    page: result.page,
    limit: result.limit,
    totalPages: result.totalPages,
  };
}
