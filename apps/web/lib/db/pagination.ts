/** Zero-based Supabase range (`from`/`to`) for a 1-based page + limit. */
export function pageRange(
  page: number,
  limit: number
): { from: number; to: number } {
  const from = (page - 1) * limit;
  return { from, to: from + limit - 1 };
}

/** Standard pagination metadata shared by every paginated list response. */
export function paginationMeta(
  totalCount: number,
  page: number,
  limit: number
): { totalCount: number; page: number; limit: number; totalPages: number } {
  return {
    totalCount,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(totalCount / limit)),
  };
}
