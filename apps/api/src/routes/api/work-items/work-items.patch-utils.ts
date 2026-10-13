/**
 * Shared PATCH merge / equality helpers for work-item updates.
 */

import {
  parseWorkItemLabels,
  resolveBoardDestinationColumn,
  resolveBoardSourceColumn,
  toDateOnly,
  type BoardColumn,
} from '@repo/types';
import type { DbWorkItem } from './work-items.repository';
import type { WorkItemUpdateBody } from './work-items.schemas';
import { WorkItemValidationError } from './work-items.errors';

/**
 * Prefer an explicit PATCH value (including `null`) over the stored field.
 * Must not use `??` — that would treat intentional `null` clears as "keep current".
 */
export function coalescePatchField<T>(next: T | undefined, current: T): T {
  if (next === undefined) {
    return current;
  }
  return next;
}

/** Nullish-safe equality for optional nullable PATCH fields. */
export function sameNullable<T>(
  left: T | null | undefined,
  right: T | null | undefined
): boolean {
  return (left ?? null) === (right ?? null);
}

export function resolveBoardColumnPatchValue(input: {
  readonly wasProvided: boolean;
  readonly value: string | null | undefined;
  readonly currentValue: string | null;
  readonly workflowContextChanged: boolean;
}): string | null {
  if (input.wasProvided) {
    return input.value ?? null;
  }
  return input.workflowContextChanged ? null : input.currentValue;
}

export type WorkItemFieldChangeDiff = {
  field: string;
  oldValue: unknown;
  newValue: unknown;
};

/**
 * Collect activity-worthy field diffs for the Activity feed.
 * Pass `includeStatus: false` when a `workflow_transition` row covers the move.
 */
export function collectWorkItemFieldChanges(
  current: DbWorkItem,
  input: WorkItemUpdateBody,
  options?: { includeStatus?: boolean }
): WorkItemFieldChangeDiff[] {
  const includeStatus = options?.includeStatus !== false;
  const changes: WorkItemFieldChangeDiff[] = [];

  const pushIfChanged = (
    field: string,
    oldValue: unknown,
    newValue: unknown,
    equal: boolean
  ) => {
    if (!equal) {
      changes.push({ field, oldValue, newValue });
    }
  };

  pushIfChanged(
    'title',
    current.title,
    input.title,
    input.title === current.title
  );
  pushIfChanged('type', current.type, input.type, input.type === current.type);
  pushIfChanged(
    'priority',
    current.priority,
    input.priority,
    input.priority === current.priority
  );
  pushIfChanged(
    'assignee_id',
    current.assignee_id,
    input.assignee_id ?? null,
    sameNullable(input.assignee_id, current.assignee_id)
  );
  pushIfChanged(
    'sprint_id',
    current.sprint_id,
    input.sprint_id ?? null,
    sameNullable(input.sprint_id, current.sprint_id)
  );
  pushIfChanged(
    'parent_id',
    current.parent_id,
    input.parent_id ?? null,
    sameNullable(input.parent_id, current.parent_id)
  );

  const currentLabels = parseWorkItemLabels(current.labels);
  const nextLabels = input.labels ?? currentLabels;
  pushIfChanged(
    'labels',
    currentLabels,
    nextLabels,
    JSON.stringify(nextLabels) === JSON.stringify(currentLabels)
  );

  const descriptionUnchanged =
    JSON.stringify(input.description ?? null) ===
    JSON.stringify(current.description ?? null);
  if (!descriptionUnchanged) {
    changes.push({
      field: 'description',
      oldValue: current.description == null ? null : 'updated',
      newValue: input.description == null ? null : 'updated',
    });
  }

  if (includeStatus) {
    pushIfChanged(
      'status',
      current.status,
      input.status,
      current.status === input.status
    );
  }

  return changes;
}

/**
 * True when a PATCH changes any field other than status / board placement.
 * Shared by Done read-only and workflow lock-record gates.
 */
export function hasNonStatusWorkItemFieldChanges(
  current: DbWorkItem,
  input: WorkItemUpdateBody
): boolean {
  const dueUnchanged =
    toDateOnly(input.due_date) === toDateOnly(current.due_date);
  const descriptionUnchanged =
    JSON.stringify(input.description ?? null) ===
    JSON.stringify(current.description ?? null);
  const labelsUnchanged =
    JSON.stringify(input.labels ?? parseWorkItemLabels(current.labels)) ===
    JSON.stringify(parseWorkItemLabels(current.labels));

  return (
    input.title !== current.title ||
    input.project_id !== current.project_id ||
    input.type !== current.type ||
    input.priority !== current.priority ||
    !sameNullable(input.assignee_id, current.assignee_id) ||
    !sameNullable(input.reporter_id, current.reporter_id) ||
    !dueUnchanged ||
    !sameNullable(input.sprint_id, current.sprint_id) ||
    !sameNullable(input.story_points, current.story_points) ||
    !sameNullable(input.parent_id, current.parent_id) ||
    !descriptionUnchanged ||
    !labelsUnchanged ||
    !sameNullable(input.jira_issue_key, current.jira_issue_key)
  );
}

/** Validate explicit board_column_id against configured columns (id + status). */
export function assertBoardColumnMatchesStatus(
  columns: readonly BoardColumn[],
  input: Pick<WorkItemUpdateBody, 'status' | 'board_column_id'>
): void {
  if (input.board_column_id === null) {
    return;
  }

  const configuredColumn = columns.find(
    (candidate) => candidate.id === input.board_column_id
  );
  if (!configuredColumn) {
    throw new WorkItemValidationError(
      'Board column does not exist in this project'
    );
  }
  if (configuredColumn.status !== input.status) {
    throw new WorkItemValidationError(
      'Board column does not match the work item status'
    );
  }
}

export function resolveValidatedBoardMove(
  current: Pick<DbWorkItem, 'status' | 'board_column_id'>,
  input: Pick<WorkItemUpdateBody, 'status' | 'board_column_id'>,
  columns: readonly BoardColumn[]
): {
  readonly source: BoardColumn | null;
  readonly destination: BoardColumn;
  readonly boardMove: {
    readonly source: BoardColumn;
    readonly destination: BoardColumn;
  } | null;
} {
  assertBoardColumnMatchesStatus(columns, input);

  const destination = resolveBoardDestinationColumn(
    { status: input.status, board_column_id: input.board_column_id },
    columns
  );
  if (!destination) {
    throw new WorkItemValidationError(
      'Board column does not exist in this project'
    );
  }

  const source = resolveBoardSourceColumn(current, columns);
  const boardMove =
    source && source.id !== destination.id ? { source, destination } : null;

  return { source, destination, boardMove };
}
