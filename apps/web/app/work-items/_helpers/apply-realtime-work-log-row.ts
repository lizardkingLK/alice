import {
  resolveRealtimeUserLookup,
  type RealtimeUserLookup,
} from '@/lib/realtime/realtime-user-lookup';
import type { ScopedRealtimeEvent } from '@/lib/realtime/use-scoped-table-realtime';
import type { WorkItemWorkLog, WorkItemWorkLogUser } from '@repo/types';

export type WorkLogRealtimeRow = {
  readonly id: string;
  readonly work_item_id: string;
  readonly user_id: string;
  readonly logged_hours: number;
  readonly logged_at: string;
  readonly comment: string | null;
  readonly status?: 'active' | 'archived';
};

export type WorkLogUserLookup = RealtimeUserLookup;

function resolveUser(
  userId: string,
  users: readonly WorkLogUserLookup[]
): WorkItemWorkLogUser {
  const resolved = resolveRealtimeUserLookup(userId, users);
  return {
    id: resolved.id,
    name: resolved.name,
    email: resolved.email,
    profile_picture: resolved.profile_picture,
  };
}

function toWorkLog(
  row: WorkLogRealtimeRow,
  users: readonly WorkLogUserLookup[],
  previous?: WorkItemWorkLog
): WorkItemWorkLog {
  return {
    id: row.id,
    work_item_id: row.work_item_id,
    user_id: row.user_id,
    logged_hours: row.logged_hours,
    logged_at: row.logged_at,
    comment: row.comment,
    user: resolveUser(row.user_id, users) ?? previous?.user ?? null,
  };
}

function isActiveStatus(status: string | undefined): boolean {
  return status === undefined || status === 'active';
}

function isWorkLogRealtimeRow(
  row: Partial<WorkLogRealtimeRow> | null
): row is WorkLogRealtimeRow {
  return Boolean(
    row?.id &&
    typeof row.id === 'string' &&
    typeof row.work_item_id === 'string' &&
    typeof row.user_id === 'string' &&
    typeof row.logged_hours === 'number' &&
    typeof row.logged_at === 'string'
  );
}

/**
 * Merge a work_item_worklogs postgres_changes payload into the local list.
 * Returns null when unchanged. Inactive/archived rows are removed.
 */
export function applyRealtimeWorkLogChange(
  workLogs: readonly WorkItemWorkLog[],
  eventType: ScopedRealtimeEvent,
  row: Partial<WorkLogRealtimeRow> | null,
  users: readonly WorkLogUserLookup[] = []
): WorkItemWorkLog[] | null {
  if (eventType === 'DELETE') {
    const id = row?.id;
    if (!id) {
      return null;
    }
    const next = workLogs.filter((log) => log.id !== id);
    return next.length === workLogs.length ? null : next;
  }

  if (!isWorkLogRealtimeRow(row)) {
    return null;
  }

  if (!isActiveStatus(row.status)) {
    const next = workLogs.filter((log) => log.id !== row.id);
    return next.length === workLogs.length ? null : next;
  }

  const index = workLogs.findIndex((log) => log.id === row.id);

  if (eventType === 'INSERT') {
    if (index >= 0) {
      return null;
    }
    return [toWorkLog(row, users), ...workLogs];
  }

  // UPDATE — replace in place, or prepend if somehow missing.
  if (index < 0) {
    return [toWorkLog(row, users), ...workLogs];
  }

  const next = [...workLogs];
  next[index] = toWorkLog(row, users, workLogs[index]);
  return next;
}
