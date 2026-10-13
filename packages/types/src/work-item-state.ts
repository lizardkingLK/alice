import { z } from 'zod';

import { WorkItemStatusEnum, type WorkItemStatus } from './work-item-status.js';

/** Seeded default workflow id (envelope Step 2); bridge uses this for legacy rows. */
export const DEFAULT_WORKFLOW_ID = 'wf-default';

/** Coarse buckets for filters, charts, and Done-style gates. */
export const WORKFLOW_STATE_CATEGORIES = [
  'draft',
  'todo',
  'in_progress',
  'done',
] as const;

export type WorkflowStateCategory = (typeof WORKFLOW_STATE_CATEGORIES)[number];

const workflowStateCategorySchema = z.enum(WORKFLOW_STATE_CATEGORIES);

const historyEntrySchema = z.object({
  stateId: z.string().min(1),
  updatedAt: z.string().min(1),
});

export const workItemStateSchema = z.object({
  workflowId: z.string().min(1),
  stateId: z.string().min(1),
  category: workflowStateCategorySchema,
  historyByWorkflow: z.record(z.string(), historyEntrySchema).optional(),
});

export type WorkItemState = z.infer<typeof workItemStateSchema>;

export type WorkItemStateHistoryEntry = z.infer<typeof historyEntrySchema>;

/** Map legacy enum status → category (seeded default workflow). */
export function categoryFromWorkItemStatus(
  status: WorkItemStatus
): WorkflowStateCategory {
  switch (status) {
    case WorkItemStatusEnum.Draft:
      return 'draft';
    case WorkItemStatusEnum.New:
    case WorkItemStatusEnum.ToDo:
      return 'todo';
    case WorkItemStatusEnum.InProgress:
    case WorkItemStatusEnum.Testing:
      return 'in_progress';
    case WorkItemStatusEnum.Done:
      return 'done';
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

/**
 * Prefer `stateId` when it matches a known WorkItemStatus; otherwise pick a
 * representative status for the category (compatibility window).
 */
export function legacyStatusFromWorkItemState(
  state: WorkItemState
): WorkItemStatus {
  if (isWorkItemStatus(state.stateId)) {
    return state.stateId;
  }
  return representativeStatusForCategory(state.category);
}

export function representativeStatusForCategory(
  category: WorkflowStateCategory
): WorkItemStatus {
  switch (category) {
    case 'draft':
      return WorkItemStatusEnum.Draft;
    case 'todo':
      return WorkItemStatusEnum.ToDo;
    case 'in_progress':
      return WorkItemStatusEnum.InProgress;
    case 'done':
      return WorkItemStatusEnum.Done;
    default: {
      const _exhaustive: never = category;
      return _exhaustive;
    }
  }
}

function isWorkItemStatus(value: string): value is WorkItemStatus {
  return (
    value === WorkItemStatusEnum.Draft ||
    value === WorkItemStatusEnum.New ||
    value === WorkItemStatusEnum.ToDo ||
    value === WorkItemStatusEnum.InProgress ||
    value === WorkItemStatusEnum.Testing ||
    value === WorkItemStatusEnum.Done
  );
}

/**
 * Build single-current state from legacy status / board column.
 * `stateId` prefers `boardColumnId`, then explicit `stateId`, else status enum.
 */
export function buildWorkItemStateFromLegacy(params: {
  readonly status: WorkItemStatus;
  readonly workflowId?: string;
  readonly stateId?: string;
  readonly boardColumnId?: string | null;
  readonly historyByWorkflow?: WorkItemState['historyByWorkflow'];
}): WorkItemState {
  const stateId =
    params.stateId?.trim() || params.boardColumnId?.trim() || params.status;

  return workItemStateSchema.parse({
    workflowId: params.workflowId?.trim() || DEFAULT_WORKFLOW_ID,
    stateId,
    category: categoryFromWorkItemStatus(params.status),
    ...(params.historyByWorkflow
      ? { historyByWorkflow: params.historyByWorkflow }
      : {}),
  });
}

/** Soft-parse DB JSON; invalid / null → null (caller falls back to status). */
export function parseWorkItemState(value: unknown): WorkItemState | null {
  if (value == null) {
    return null;
  }
  const parsed = workItemStateSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/**
 * Resolve effective state for a row: prefer valid `state`, else derive from status.
 */
export function resolveWorkItemState(params: {
  readonly state?: unknown;
  readonly status: WorkItemStatus;
  readonly boardColumnId?: string | null;
  readonly workflowId?: string;
}): WorkItemState {
  const existing = parseWorkItemState(params.state);
  if (existing) {
    return existing;
  }
  return buildWorkItemStateFromLegacy({
    status: params.status,
    boardColumnId: params.boardColumnId,
    workflowId: params.workflowId,
  });
}

/**
 * When category enters/leaves `done`, return the `done_at` value to write.
 * `undefined` = leave column unchanged.
 */
export function doneAtForCategoryChange(params: {
  readonly previousCategory: WorkflowStateCategory | null | undefined;
  readonly nextCategory: WorkflowStateCategory;
  readonly now?: Date;
}): Date | null | undefined {
  const prev = params.previousCategory;
  const next = params.nextCategory;
  const enteringDone = next === 'done' && prev !== 'done';
  const leavingDone = prev === 'done' && next !== 'done';

  if (enteringDone) {
    return params.now ?? new Date();
  }
  if (leavingDone) {
    return null;
  }
  return undefined;
}

/**
 * Dual-write payload from a target status (and optional column) while preserving
 * history when the workflow id changes.
 */
export function syncWorkItemStateForStatusChange(params: {
  readonly nextStatus: WorkItemStatus;
  readonly previousState?: WorkItemState | null;
  readonly boardColumnId?: string | null;
  readonly workflowId?: string;
  readonly now?: Date;
}): {
  readonly state: WorkItemState;
  readonly status: WorkItemStatus;
  readonly doneAt: Date | null | undefined;
} {
  const now = params.now ?? new Date();
  const workflowId =
    params.workflowId?.trim() ||
    params.previousState?.workflowId ||
    DEFAULT_WORKFLOW_ID;

  let historyByWorkflow = params.previousState?.historyByWorkflow;

  if (params.previousState && params.previousState.workflowId !== workflowId) {
    historyByWorkflow = {
      ...historyByWorkflow,
      [params.previousState.workflowId]: {
        stateId: params.previousState.stateId,
        updatedAt: now.toISOString(),
      },
    };
  }

  const state = buildWorkItemStateFromLegacy({
    status: params.nextStatus,
    workflowId,
    boardColumnId: params.boardColumnId,
    historyByWorkflow,
  });

  return {
    state,
    status: params.nextStatus,
    doneAt: doneAtForCategoryChange({
      previousCategory: params.previousState?.category,
      nextCategory: state.category,
      now,
    }),
  };
}

/** Prisma / JSON column value. */
export function workItemStateToJson(
  state: WorkItemState
): Record<string, unknown> {
  return workItemStateSchema.parse(state);
}
