export type PaginationMeta = {
  totalCount: number;
  page: number;
  limit: number;
  totalPages: number;
};

/** Standard pagination metadata for list pages (RSC and Express). */
export function paginationMeta(
  totalCount: number,
  page: number,
  limit: number
): PaginationMeta {
  return {
    totalCount,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(totalCount / limit)),
  };
}
