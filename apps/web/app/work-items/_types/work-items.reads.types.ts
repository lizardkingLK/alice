import { User as DbUser } from '@/app/users/_services/users.mutations.client';
import type { WorkItemPrismaListFilters } from '@repo/types';
import { Tables } from '@repo/types';

type DbUserEssentials = Pick<DbUser, 'id' | 'name' | 'email'> & {
  profile_picture?: string | null;
};

/** Supabase RSC row shape for work-item reads (list + detail embeds). */
export type DbWorkItem = Tables<'work_items'> & {
  assignee: DbUserEssentials | null;
  reporter?: DbUserEssentials | null;
  project?: {
    id: string;
    key: string;
    name: string;
  } | null;
  sprint?: {
    id: string;
    name: string;
  } | null;
};

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
export type WorkItemAncestor = Pick<
  DbWorkItem,
  'id' | 'type' | 'title' | 'parent_id'
>;
