import type {
  AttachmentActivityMeta,
  WorkItemActivity,
  WorkflowTransitionMeta,
} from '@repo/types';

export type ActivityValueLookups = {
  readonly memberNamesById?: ReadonlyMap<string, string>;
  readonly sprintNamesById?: ReadonlyMap<string, string>;
};

type IdName = {
  readonly id?: string | null;
  readonly name?: string | null;
};

function putIdName(
  map: Map<string, string>,
  id: string | null | undefined,
  name: string | null | undefined
): void {
  if (id && name) {
    map.set(id, name);
  }
}

function buildIdNameMap(
  entries: readonly IdName[],
  extras: readonly IdName[] = []
): Map<string, string> {
  const map = new Map<string, string>();
  for (const entry of entries) {
    putIdName(map, entry.id, entry.name);
  }
  for (const entry of extras) {
    putIdName(map, entry.id, entry.name);
  }
  return map;
}

/** Member + sprint name maps for activity feed humanization. */
export function buildActivityValueLookups(params: {
  readonly projectMembers: readonly IdName[];
  readonly projectSprints: readonly IdName[];
  readonly assignee?: IdName | null;
  readonly reporter?: IdName | null;
  readonly sprint?: IdName | null;
}): ActivityValueLookups {
  return {
    memberNamesById: buildIdNameMap(params.projectMembers, [
      params.assignee ?? {},
      params.reporter ?? {},
    ]),
    sprintNamesById: buildIdNameMap(params.projectSprints, [
      params.sprint ?? {},
    ]),
  };
}

/** `assignee_id` → "assignee"; unknown fields stay readable. */
export function formatActivityFieldLabel(field: string | null): string {
  if (!field) {
    return 'a field';
  }
  const withoutId = field.endsWith('_id') ? field.slice(0, -3) : field;
  return withoutId.replaceAll('_', ' ');
}

function isNonBlank(value: string | null | undefined): value is string {
  return value != null && value.trim() !== '';
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  return value as Record<string, unknown>;
}

/**
 * Resolve stored activity values (often raw FKs) for display.
 * Unknown member/sprint ids fall back to a short placeholder — never a full UUID.
 */
export function formatActivityFieldValue(
  field: string | null,
  value: string | null,
  lookups: ActivityValueLookups = {}
): string {
  if (!isNonBlank(value)) {
    if (field === 'assignee_id' || field === 'reporter_id') {
      return 'Unassigned';
    }
    if (field === 'sprint_id') {
      return 'Backlog';
    }
    return 'empty';
  }

  const trimmed = value.trim();

  if (field === 'assignee_id' || field === 'reporter_id') {
    return lookups.memberNamesById?.get(trimmed) ?? 'Unknown member';
  }

  if (field === 'sprint_id') {
    return lookups.sprintNamesById?.get(trimmed) ?? 'Unknown sprint';
  }

  return trimmed;
}

export function activityActorName(activity: WorkItemActivity): string {
  return activity.actor?.name?.trim() || 'Someone';
}

function isAttachmentMeta(meta: unknown): meta is AttachmentActivityMeta {
  const record = asRecord(meta);
  return (
    record != null &&
    typeof record.attachmentId === 'string' &&
    typeof record.fileName === 'string'
  );
}

function isTransitionMeta(meta: unknown): meta is WorkflowTransitionMeta {
  const record = asRecord(meta);
  return (
    record != null &&
    typeof record.fromStateId === 'string' &&
    typeof record.toStateId === 'string' &&
    typeof record.workflowId === 'string'
  );
}

function describeAttachmentChange(
  who: string,
  meta: unknown,
  verb: 'added' | 'removed'
): string {
  const fileName = isAttachmentMeta(meta) ? meta.fileName : 'a file';
  return `${who} ${verb} attachment ${fileName}`;
}

/** Human-readable one-line summary for activity feed layouts. */
export function describeActivity(
  activity: WorkItemActivity,
  lookups: ActivityValueLookups = {}
): string {
  const who = activityActorName(activity);

  switch (activity.action) {
    case 'created':
      return `${who} created this work item`;
    case 'attachment_added':
      return describeAttachmentChange(who, activity.meta, 'added');
    case 'attachment_removed':
      return describeAttachmentChange(who, activity.meta, 'removed');
    case 'workflow_transition': {
      if (isTransitionMeta(activity.meta)) {
        return `${who} moved from ${activity.meta.fromStateId} to ${activity.meta.toStateId}`;
      }
      return `${who} changed workflow state`;
    }
    case 'escalation_resolved':
      return `${who} resolved an escalation`;
    case 'commented':
      return `${who} commented`;
    case 'field_changed': {
      const field = formatActivityFieldLabel(activity.field);
      if (activity.field === 'description') {
        return `${who} updated the description`;
      }
      const from = formatActivityFieldValue(
        activity.field,
        activity.old_value,
        lookups
      );
      const to = formatActivityFieldValue(
        activity.field,
        activity.new_value,
        lookups
      );
      return `${who} changed ${field} from ${from} to ${to}`;
    }
    default:
      return `${who} made a change`;
  }
}

/** Newest activity first (stable for equal timestamps). */
export function sortActivitiesNewestFirst(
  activities: readonly WorkItemActivity[]
): WorkItemActivity[] {
  return [...activities].sort((a, b) => {
    const byTime = b.created_at.localeCompare(a.created_at);
    if (byTime !== 0) {
      return byTime;
    }
    return b.id.localeCompare(a.id);
  });
}
