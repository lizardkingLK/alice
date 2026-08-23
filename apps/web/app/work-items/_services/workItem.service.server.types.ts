import { User as DbUser } from '@/app/users/_services/users.service';
import { Enums, Tables } from '@repo/types';

type DbUserEssentials = Pick<DbUser, 'id' | 'name' | 'email'> & {
  profile_picture?: string | null;
};

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

export type WorkItemListFilters = {
  sprintId?: string | null;
  projectId?: string;
  /** Restrict to these projects (membership scope). Intersects with `projectId` when both set. */
  projectIds?: readonly string[];
  /** Exact parent, or `null` for unparented (orphan) items. */
  parentId?: string | null;
  type?: Enums<'WorkItemType'>;
  assigneeId?: string;
  /** Exact case-sensitive labels; match if the item contains any (OR). */
  labels?: string[];
  /** Lifecycle filter. Defaults to `active`. */
  recordStatus?: 'active' | 'archived';
};

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
