import { Request } from 'express';

export interface ParsedPagination {
  readonly page: number;
  readonly limit: number;
}

export function parsePagination(req: Request): ParsedPagination | null {
  const pageQuery = req.query.page;
  const limitQuery = req.query.limit;

  if (pageQuery !== undefined && limitQuery !== undefined) {
    const page = Number.parseInt(pageQuery as string, 10);
    const limit = Number.parseInt(limitQuery as string, 10);

    if (!Number.isNaN(page) && page > 0 && !Number.isNaN(limit) && limit > 0) {
      return { page, limit };
    }
  }

  return null;
}
