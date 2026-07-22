export type PaginationMeta = {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
};

export const paginationFactory = {
  build(overrides: Partial<PaginationMeta> = {}): PaginationMeta {
    return {
      page: 1,
      limit: 10,
      totalCount: 2,
      totalPages: 1,
      ...overrides,
    };
  },
};
