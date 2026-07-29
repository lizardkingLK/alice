import { USER_PROJECTION, userRelationSelect } from './users.js';

/** Nested author embed on work-log selects. */
export type WorkItemWorkLogUser = {
  id: string;
  name: string;
  email: string;
  profile_picture: string | null;
};

/**
 * Work-log row with optional user embed — shared by API repository and web SSR/client.
 * Table is not yet in generated Supabase types, so this is a hand-maintained DTO.
 */
export type WorkItemWorkLog = {
  id: string;
  work_item_id: string;
  user_id: string;
  logged_hours: number;
  logged_at: string;
  comment: string | null;
  user?: WorkItemWorkLogUser | null;
};

/** Raw PostgREST row before user-embed normalization. */
export type WorkItemWorkLogRowRaw = Omit<WorkItemWorkLog, 'user'> & {
  user?: unknown;
};

/** Shared PostgREST select for work log + author embed. */
export const WORK_ITEM_WORKLOG_SELECT = [
  'id',
  'work_item_id',
  'user_id',
  'logged_hours',
  'logged_at',
  'comment',
  userRelationSelect('user', 'user_id', USER_PROJECTION),
].join(', ');

export function normalizeWorkLogUser(
  userRaw: unknown
): WorkItemWorkLogUser | null {
  if (Array.isArray(userRaw)) {
    const first = userRaw[0] as WorkItemWorkLogUser | undefined;
    return first ?? null;
  }

  const user = userRaw as WorkItemWorkLogUser | null | undefined;
  return user ?? null;
}

export function normalizeWorkLogRow(
  row: WorkItemWorkLogRowRaw
): WorkItemWorkLog {
  return {
    ...row,
    user: normalizeWorkLogUser(row.user),
  };
}
