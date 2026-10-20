import { apiFetch } from '@/lib/api/api-fetch.reads.use.server';
import { asIso } from '@/lib/api/wire-date';
import type { GetUsersPaginatedResponse, User } from './users.mutations.shared';

/** Align Express JSON (ISO timestamps) with the PostgREST `users` row shape. */
export function mapUserApiRow(row: Record<string, unknown>): User {
  return {
    ...row,
    created_at: asIso(row.created_at),
    updated_at: asIso(row.updated_at),
  } as unknown as User;
}

/** Query string for `GET /api/users` (matches `listUsersQuerySchema`). */
export function buildUsersListSearchParams(input: {
  page: number;
  limit: number;
  search?: string;
}): URLSearchParams {
  const params = new URLSearchParams();
  params.set('page', String(input.page));
  params.set('limit', String(input.limit));

  const search = input.search?.trim();
  if (search) {
    params.set('search', search);
  }

  return params;
}

/** Optional RSC read path via Express GET (`DATA_READS_VIA_API` toggle). */
export async function getUsersListPaginatedFromApi(
  page: number,
  limit: number,
  search = ''
): Promise<GetUsersPaginatedResponse> {
  const params = buildUsersListSearchParams({ page, limit, search });
  const result = await apiFetch<GetUsersPaginatedResponse>(
    `/api/users?${params.toString()}`
  );

  return {
    ...result,
    users: result.users.map((row) =>
      mapUserApiRow(row as unknown as Record<string, unknown>)
    ),
  };
}
