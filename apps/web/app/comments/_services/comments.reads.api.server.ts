import { apiFetch } from '@/lib/api/api-fetch.reads.use.server';
import { asIso } from '@/lib/api/wire-date';
import type { CommentItem } from './comments.mutations.shared';

/** Max `limit` accepted by `listCommentsQuerySchema` (`paginatedListLimitField`). */
export const COMMENTS_API_PAGE_LIMIT = 100;

/**
 * Safety cap so an unscoped list cannot fan out without bound. The Supabase
 * reader is unpaginated, so this keeps the two paths comparable for threads.
 */
export const COMMENTS_API_MAX_PAGES = 20;

type CommentsListResponse = {
  comments: Record<string, unknown>[];
  totalCount: number;
  page: number;
  limit: number;
  totalPages: number;
};

/** Align Express JSON (Prisma ISO dates) with the PostgREST `CommentItem` shape. */
export function mapCommentApiRow(row: Record<string, unknown>): CommentItem {
  return {
    ...row,
    created_at: asIso(row.created_at),
    updated_at: asIso(row.updated_at),
  } as unknown as CommentItem;
}

/** Query string for `GET /api/comments` (matches `listCommentsQuerySchema`). */
export function buildCommentsListSearchParams(input: {
  page: number;
  limit: number;
  workItemId?: string;
}): URLSearchParams {
  const params = new URLSearchParams();
  params.set('page', String(input.page));
  params.set('limit', String(input.limit));
  if (input.workItemId) {
    params.set('workItemId', input.workItemId);
  }
  return params;
}

function fetchCommentsPage(
  page: number,
  workItemId?: string
): Promise<CommentsListResponse> {
  const params = buildCommentsListSearchParams({
    page,
    limit: COMMENTS_API_PAGE_LIMIT,
    workItemId,
  });
  return apiFetch<CommentsListResponse>(`/api/comments?${params.toString()}`);
}

/**
 * Optional RSC read path via Express GET (`DATA_READS_VIA_API` toggle).
 * The page contract is unpaginated, so request the max page size and fetch any
 * remaining pages (newest first, same order as the Supabase reader).
 */
export async function listCommentsFromApi(
  workItemId?: string
): Promise<CommentItem[]> {
  const first = await fetchCommentsPage(1, workItemId);
  const lastPage = Math.min(first.totalPages, COMMENTS_API_MAX_PAGES);

  const rest =
    lastPage > 1
      ? await Promise.all(
          Array.from({ length: lastPage - 1 }, (_, i) =>
            fetchCommentsPage(i + 2, workItemId)
          )
        )
      : [];

  return [first, ...rest]
    .flatMap((page) => page.comments)
    .map(mapCommentApiRow);
}
