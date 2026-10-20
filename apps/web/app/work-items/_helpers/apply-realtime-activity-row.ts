import {
  resolveRealtimeUserLookup,
  type RealtimeUserLookup,
} from '@/lib/realtime/realtime-user-lookup';
import type { ScopedRealtimeEvent } from '@/lib/realtime/use-scoped-table-realtime';
import {
  ACTIVITY_FEED_LIMIT,
  type ActivityAction,
  type Json,
  type WorkItemActivity,
  type WorkItemActivityActor,
} from '@repo/types';

export type ActivityRealtimeRow = {
  readonly id: string;
  readonly work_item_id: string;
  readonly actor_id: string | null;
  readonly action: ActivityAction;
  readonly field: string | null;
  readonly old_value: string | null;
  readonly new_value: string | null;
  readonly meta: Json | null;
  readonly created_at: string;
};

export type ActivityActorLookup = RealtimeUserLookup;

function resolveActor(
  actorId: string | null,
  actors: readonly ActivityActorLookup[]
): WorkItemActivityActor | null {
  if (!actorId) {
    return null;
  }
  const resolved = resolveRealtimeUserLookup(actorId, actors);
  return {
    id: resolved.id,
    name: resolved.name,
    email: resolved.email,
    profile_picture: resolved.profile_picture,
  };
}

function toActivity(
  row: ActivityRealtimeRow,
  actors: readonly ActivityActorLookup[]
): WorkItemActivity {
  return {
    id: row.id,
    work_item_id: row.work_item_id,
    actor_id: row.actor_id,
    action: row.action,
    field: row.field,
    old_value: row.old_value,
    new_value: row.new_value,
    meta: row.meta,
    created_at: row.created_at,
    actor: resolveActor(row.actor_id, actors),
  };
}

function isActivityRealtimeRow(
  row: Partial<ActivityRealtimeRow> | null
): row is ActivityRealtimeRow {
  return Boolean(
    row?.id &&
    typeof row.id === 'string' &&
    typeof row.work_item_id === 'string' &&
    typeof row.action === 'string' &&
    typeof row.created_at === 'string'
  );
}

/**
 * Merge an activities postgres_changes payload into the local feed.
 * Returns null when unchanged. Caps length at {@link ACTIVITY_FEED_LIMIT}.
 */
export function applyRealtimeActivityChange(
  activities: readonly WorkItemActivity[],
  eventType: ScopedRealtimeEvent,
  row: Partial<ActivityRealtimeRow> | null,
  actors: readonly ActivityActorLookup[] = []
): WorkItemActivity[] | null {
  if (eventType === 'DELETE') {
    const id = row?.id;
    if (!id) {
      return null;
    }
    const next = activities.filter((activity) => activity.id !== id);
    return next.length === activities.length ? null : next;
  }

  if (!isActivityRealtimeRow(row)) {
    return null;
  }

  if (activities.some((activity) => activity.id === row.id)) {
    return null;
  }

  // Activities are append-only in practice; INSERT (and rare UPDATE) prepend.
  const next = [toActivity(row, actors), ...activities].slice(
    0,
    ACTIVITY_FEED_LIMIT
  );
  return next;
}
