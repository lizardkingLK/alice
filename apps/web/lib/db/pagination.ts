export { paginationMeta, type PaginationMeta } from '@repo/types';

/** Zero-based Supabase range (`from`/`to`) for a 1-based page + limit. */
export function pageRange(
  page: number,
  limit: number
): { from: number; to: number } {
  const from = (page - 1) * limit;
  return { from, to: from + limit - 1 };
}
