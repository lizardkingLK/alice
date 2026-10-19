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
  /** Optional title/label search (same OR filter as paginated list). */
  readonly search?: string;
};

/** Minimal ancestor fields for the in-page hierarchy path. */
export type WorkItemAncestor = WorkItemAncestorWireRow;

/** Hierarchy list page: forest budget (browse) or search hits + panel tree. */
export type GetWorkItemsHierarchyPageResponse =
  GetWorkItemsPaginatedResponse & {
    readonly childrenByParentId: Record<string, DbWorkItem[]>;
    readonly mode: 'tree' | 'search';
    readonly searchPanelItems: DbWorkItem[];
    readonly searchMatchIds: readonly string[];
    readonly ancestorsById: Record<string, WorkItemAncestor[]>;
    readonly focusId: string | null;
  };

export type GetWorkItemsHierarchyPageOptions = {
  readonly focusId?: string | null;
};
