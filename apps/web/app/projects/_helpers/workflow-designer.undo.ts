import type { WorkflowConfigEnvelope } from '@repo/types/api/v1';
import { cloneWorkflowEnvelope } from '@/app/projects/_helpers/workflow-designer.layout';

export const WORKFLOW_UNDO_CAP = 50;
export const WORKFLOW_UNDO_COALESCE_MS = 400;

export type WorkflowUndoStack = {
  readonly snapshots: readonly WorkflowConfigEnvelope[];
  readonly lastCoalesceKey: string | null;
  readonly lastCoalesceAt: number;
};

export function createWorkflowUndoStack(): WorkflowUndoStack {
  return {
    snapshots: [],
    lastCoalesceKey: null,
    lastCoalesceAt: 0,
  };
}

export function clearWorkflowUndo(): WorkflowUndoStack {
  return createWorkflowUndoStack();
}

/**
 * Push a snapshot of the envelope *before* a mutation.
 * When `coalesceKey` matches the previous push within the coalesce window,
 * replace the tip instead of growing the stack (name typing).
 */
export function pushWorkflowUndo(
  stack: WorkflowUndoStack,
  envelopeBefore: WorkflowConfigEnvelope,
  options?: {
    readonly coalesceKey?: string;
    readonly now?: number;
  }
): WorkflowUndoStack {
  const now = options?.now ?? Date.now();
  const coalesceKey = options?.coalesceKey ?? null;

  // Same coalesce key within the window: keep the first pre-edit snapshot.
  if (
    coalesceKey &&
    stack.lastCoalesceKey === coalesceKey &&
    now - stack.lastCoalesceAt < WORKFLOW_UNDO_COALESCE_MS &&
    stack.snapshots.length > 0
  ) {
    return {
      ...stack,
      lastCoalesceAt: now,
    };
  }

  const next = [...stack.snapshots, cloneWorkflowEnvelope(envelopeBefore)];
  while (next.length > WORKFLOW_UNDO_CAP) {
    next.shift();
  }
  return {
    snapshots: next,
    lastCoalesceKey: coalesceKey,
    lastCoalesceAt: now,
  };
}

export function popWorkflowUndo(stack: WorkflowUndoStack): {
  readonly stack: WorkflowUndoStack;
  readonly envelope: WorkflowConfigEnvelope;
} | null {
  if (stack.snapshots.length === 0) {
    return null;
  }
  const next = [...stack.snapshots];
  const envelope = next.pop()!;
  return {
    envelope,
    stack: {
      snapshots: next,
      lastCoalesceKey: null,
      lastCoalesceAt: 0,
    },
  };
}
