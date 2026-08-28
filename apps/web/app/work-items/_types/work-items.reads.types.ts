import type {
  WorkItemAncestorWireRow,
  WorkItemPrismaListFilters,
  WorkItemReadRow,
} from '@repo/types/api/v1';

/** v1 wire read row (PostgREST / Express JSON — ISO date strings). */
export type DbWorkItem = WorkItemReadRow;

/** List/detail filters shared with Express `listWorkItemsQuerySchema`. */
export type WorkItemListFilters = WorkItemPrismaListFilters;

export type GetWorkItemsPaginatedResponse = {
  workItems: DbWorkItem[];
  totalCount: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type GetWorkItemsOptions = {
  readonly includeDescription?: boolean;
};

/** Minimal ancestor fields for the in-page hierarchy path. */
export type WorkItemAncestor = WorkItemAncestorWireRow;
