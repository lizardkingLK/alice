import { z } from 'zod';

import type { WorkflowStateCategory } from '../../work-item-state.js';
import {
  findWorkflowById,
  type WorkflowConfigEnvelope,
  type WorkflowStateNode,
} from './workflow-config.js';

/** Save blocked because work items still sit on removed workflow states. */
export const WORKFLOW_ORPHANED_STATES_CODE =
  'WORKFLOW_ORPHANED_STATES' as const;

export const workflowStateRemapSchema = z.object({
  workflowId: z.string().trim().min(1),
  fromStateId: z.string().trim().min(1),
  toStateId: z.string().trim().min(1),
});

export type WorkflowStateRemap = z.infer<typeof workflowStateRemapSchema>;

export type WorkflowRemovedStateRef = {
  readonly workflowId: string;
  readonly workflowTitle: string;
  readonly stateId: string;
  readonly stateName: string;
  readonly category: WorkflowStateCategory;
};

export type WorkflowOrphanedStateGroup = WorkflowRemovedStateRef & {
  readonly affectedCount: number;
};

export type WorkflowAvailableStateOption = {
  readonly id: string;
  readonly name: string;
  readonly category: WorkflowStateCategory;
};

export type WorkflowOrphanedStatesConflict = {
  readonly code: typeof WORKFLOW_ORPHANED_STATES_CODE;
  readonly message: string;
  readonly groups: readonly WorkflowOrphanedStateGroup[];
  readonly totalAffected: number;
  readonly availableStatesByWorkflow: Readonly<
    Record<string, readonly WorkflowAvailableStateOption[]>
  >;
};

function stateOption(state: WorkflowStateNode): WorkflowAvailableStateOption {
  return {
    id: state.id,
    name: state.name,
    category: state.category,
  };
}

/** States present in `previous` but missing from the matching workflow in `next`. */
export function listRemovedWorkflowStates(
  previous: WorkflowConfigEnvelope,
  next: WorkflowConfigEnvelope
): readonly WorkflowRemovedStateRef[] {
  const removed: WorkflowRemovedStateRef[] = [];

  for (const previousWorkflow of previous.workflows) {
    const nextWorkflow = findWorkflowById(next, previousWorkflow.id);
    if (!nextWorkflow) {
      continue;
    }
    const nextIds = new Set(nextWorkflow.graph.states.map((state) => state.id));
    for (const state of previousWorkflow.graph.states) {
      if (nextIds.has(state.id)) {
        continue;
      }
      removed.push({
        workflowId: previousWorkflow.id,
        workflowTitle: previousWorkflow.title,
        stateId: state.id,
        stateName: state.name,
        category: state.category,
      });
    }
  }

  return removed;
}

/** Workflow ids present in `previous` but absent from `next`. */
export function listRemovedWorkflowIds(
  previous: WorkflowConfigEnvelope,
  next: WorkflowConfigEnvelope
): readonly string[] {
  const nextIds = new Set(next.workflows.map((workflow) => workflow.id));
  return previous.workflows
    .filter((workflow) => !nextIds.has(workflow.id))
    .map((workflow) => workflow.id);
}

export function buildAvailableStatesByWorkflow(
  envelope: WorkflowConfigEnvelope,
  workflowIds: readonly string[]
): Record<string, WorkflowAvailableStateOption[]> {
  const result: Record<string, WorkflowAvailableStateOption[]> = {};
  for (const workflowId of workflowIds) {
    const workflow = findWorkflowById(envelope, workflowId);
    if (!workflow) {
      continue;
    }
    result[workflowId] = workflow.graph.states.map(stateOption);
  }
  return result;
}

/**
 * Every removed placement that has affected items must have a remap whose
 * `toStateId` exists on that workflow in `next`.
 */
export function validateWorkflowStateRemaps(params: {
  readonly next: WorkflowConfigEnvelope;
  readonly removedWithCounts: readonly WorkflowOrphanedStateGroup[];
  readonly remaps: readonly WorkflowStateRemap[];
}): { readonly ok: true } | { readonly ok: false; readonly message: string } {
  const { next, removedWithCounts, remaps } = params;
  if (removedWithCounts.length === 0) {
    return { ok: true };
  }

  const remapKey = (workflowId: string, fromStateId: string) =>
    `${workflowId}::${fromStateId}`;

  const byKey = new Map<string, WorkflowStateRemap>();
  for (const remap of remaps) {
    byKey.set(remapKey(remap.workflowId, remap.fromStateId), remap);
  }

  for (const group of removedWithCounts) {
    if (group.affectedCount <= 0) {
      continue;
    }
    const remap = byKey.get(remapKey(group.workflowId, group.stateId));
    if (!remap) {
      return {
        ok: false,
        message: `Choose a new state for "${group.stateName}" on ${group.workflowTitle} before saving.`,
      };
    }
    const workflow = findWorkflowById(next, group.workflowId);
    if (!workflow) {
      return {
        ok: false,
        message: `Workflow "${group.workflowTitle}" is missing from the saved configuration.`,
      };
    }
    if (!workflow.graph.states.some((state) => state.id === remap.toStateId)) {
      return {
        ok: false,
        message: `Target state is not on ${group.workflowTitle}.`,
      };
    }
    if (remap.toStateId === group.stateId) {
      return {
        ok: false,
        message: `Pick a different state than the removed "${group.stateName}".`,
      };
    }
  }

  return { ok: true };
}

export function buildWorkflowOrphanedStatesConflict(params: {
  readonly groups: readonly WorkflowOrphanedStateGroup[];
  readonly availableStatesByWorkflow: Readonly<
    Record<string, readonly WorkflowAvailableStateOption[]>
  >;
}): WorkflowOrphanedStatesConflict {
  const totalAffected = params.groups.reduce(
    (sum, group) => sum + group.affectedCount,
    0
  );
  const stateLabel =
    params.groups.length === 1
      ? `"${params.groups[0]!.stateName}"`
      : `${params.groups.length} removed states`;
  return {
    code: WORKFLOW_ORPHANED_STATES_CODE,
    message: `${totalAffected} work item${totalAffected === 1 ? '' : 's'} still use ${stateLabel}. Move them to another state or discard your changes.`,
    groups: params.groups,
    totalAffected,
    availableStatesByWorkflow: params.availableStatesByWorkflow,
  };
}

export function isWorkflowOrphanedStatesConflict(
  value: unknown
): value is WorkflowOrphanedStatesConflict {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const record = value as { code?: unknown; groups?: unknown };
  return (
    record.code === WORKFLOW_ORPHANED_STATES_CODE &&
    Array.isArray(record.groups)
  );
}

/** Prefer a remaining state with the same category; else first remaining state. */
export function suggestRemapTargetState(
  available: readonly WorkflowAvailableStateOption[],
  missingCategory: WorkflowStateCategory | null
): WorkflowAvailableStateOption | null {
  if (available.length === 0) {
    return null;
  }
  if (missingCategory) {
    const sameCategory = available.find(
      (state) => state.category === missingCategory
    );
    if (sameCategory) {
      return sameCategory;
    }
  }
  return available[0] ?? null;
}
