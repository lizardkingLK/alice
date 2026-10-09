import type { Tables } from './generated/supabase/database.types.js';
import { Constants } from './generated/supabase/database.types.js';
import { USER_PROJECTION, userRelationSelect } from './users.js';

export const ACTIVITY_ACTIONS = Constants.public.Enums.ActivityAction;
export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number];

/** Nested actor embed on activity selects. */
export type WorkItemActivityActor = {
  id: string;
  name: string;
  email: string;
  profile_picture: string | null;
};

export type WorkflowTransitionMeta = {
  fromStateId: string;
  toStateId: string;
  workflowId: string;
  edgeId: string | null;
};

export type { EscalationResolvedMeta } from './api/v1/workflow-resolution.js';

export type AttachmentActivityMeta = {
  attachmentId: string;
  fileName: string;
};

export type WorkItemActivity = Pick<
  Tables<'activities'>,
  | 'id'
  | 'work_item_id'
  | 'actor_id'
  | 'action'
  | 'field'
  | 'old_value'
  | 'new_value'
  | 'meta'
  | 'created_at'
> & {
  actor: WorkItemActivityActor | null;
};

/** Raw PostgREST row before actor-embed normalization. */
export type WorkItemActivityRowRaw = Omit<WorkItemActivity, 'actor'> & {
  actor?: unknown;
};

export const ACTIVITY_ACTOR_SELECT = userRelationSelect(
  'actor',
  'actor_id',
  USER_PROJECTION
);

/** Shared PostgREST select for activity + actor embed. */
export const WORK_ITEM_ACTIVITY_SELECT = [
  'id',
  'work_item_id',
  'actor_id',
  'action',
  'field',
  'old_value',
  'new_value',
  'meta',
  'created_at',
  ACTIVITY_ACTOR_SELECT,
].join(', ');

export const ACTIVITY_FEED_LIMIT = 50;

export function normalizeActivityActor(
  actorRaw: unknown
): WorkItemActivityActor | null {
  if (Array.isArray(actorRaw)) {
    const first = actorRaw[0] as WorkItemActivityActor | undefined;
    return first ?? null;
  }

  const actor = actorRaw as WorkItemActivityActor | null | undefined;
  return actor ?? null;
}

export function normalizeActivityRow(
  row: WorkItemActivityRowRaw
): WorkItemActivity {
  return {
    ...row,
    actor: normalizeActivityActor(row.actor),
  };
}

export function serializeActivityValue(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return JSON.stringify(value);
}
