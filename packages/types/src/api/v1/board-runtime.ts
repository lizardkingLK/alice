import {
  boardConfigSchema,
  normalizeBoardConfig,
  type BoardColumn,
  type RuntimeBoardConfig,
} from './board-config.js';
import {
  findWorkflowById,
  parseWorkflowConfigEnvelope,
  resolveWorkflowForWorkItemType,
  type WorkflowConfigEnvelope,
  type WorkflowDocument,
  type WorkflowEdge,
  type WorkflowStateNode,
} from './workflow-config.js';
import {
  legacyStatusFromWorkItemState,
  resolveWorkItemState,
  type WorkItemState,
} from '../../work-item-state.js';
import {
  BOARD_WORK_ITEM_STATUSES,
  WorkItemStatusEnum,
  type WorkItemStatus,
} from '../../work-item-status.js';
import type { WorkItemType } from '../../work-item-types.js';

export type BoardWorkflowTab = {
  readonly id: string;
  readonly title: string;
  readonly isDefault: boolean;
  readonly typeBindings: readonly WorkItemType[];
};

export type WorkflowBoardRuntime = {
  readonly kind: 'workflow';
  readonly envelope: WorkflowConfigEnvelope;
  readonly activeWorkflow: WorkflowDocument;
  readonly columns: BoardColumn[];
  readonly tabs: readonly BoardWorkflowTab[];
};

export type LegacyBoardRuntime = {
  readonly kind: 'legacy';
  readonly config: RuntimeBoardConfig;
  readonly columns: BoardColumn[];
};

export type DefaultBoardRuntime = {
  readonly kind: 'default';
};

export type ProjectBoardRuntime =
  WorkflowBoardRuntime | LegacyBoardRuntime | DefaultBoardRuntime;

function isBoardWorkItemStatus(
  value: string
): value is (typeof BOARD_WORK_ITEM_STATUSES)[number] {
  return (BOARD_WORK_ITEM_STATUSES as readonly string[]).includes(value);
}

/**
 * Map a workflow state to a kanban column. Draft-category states are omitted
 * from the board strip (items in Draft stay off the board).
 */
export function workflowStateToBoardColumn(
  state: WorkflowStateNode
): BoardColumn | null {
  if (state.category === 'draft') {
    return null;
  }

  const bridged = legacyStatusFromWorkItemState({
    workflowId: 'unused',
    stateId: state.id,
    category: state.category,
  });
  const status = isBoardWorkItemStatus(bridged)
    ? bridged
    : WorkItemStatusEnum.ToDo;

  return {
    id: state.id,
    name: state.name,
    status,
  };
}

export function workflowStatesToBoardColumns(
  workflow: WorkflowDocument
): BoardColumn[] {
  return workflow.graph.states
    .map((state) => workflowStateToBoardColumn(state))
    .filter((column): column is BoardColumn => column !== null);
}

export function listBoardWorkflowTabs(
  envelope: WorkflowConfigEnvelope
): BoardWorkflowTab[] {
  return envelope.workflows.map((workflow) => ({
    id: workflow.id,
    title: workflow.title,
    isDefault: workflow.id === envelope.defaultWorkflowId,
    typeBindings: workflow.typeBindings,
  }));
}

export function findWorkflowEdge(
  workflow: WorkflowDocument,
  fromStateId: string,
  toStateId: string
): WorkflowEdge | null {
  return (
    workflow.graph.edges.find(
      (edge) => edge.from === fromStateId && edge.to === toStateId
    ) ?? null
  );
}

export function findWorkflowState(
  workflow: WorkflowDocument,
  stateId: string
): WorkflowStateNode | null {
  return workflow.graph.states.find((state) => state.id === stateId) ?? null;
}

export function resolveActiveWorkflow(
  envelope: WorkflowConfigEnvelope,
  workflowId: string | null | undefined
): WorkflowDocument {
  if (workflowId) {
    const selected = findWorkflowById(envelope, workflowId);
    if (selected) {
      return selected;
    }
  }
  return (
    findWorkflowById(envelope, envelope.defaultWorkflowId) ??
    envelope.workflows[0]!
  );
}

/**
 * Prefer a persisted workflow envelope, else legacy board v1/v2, else default.
 * Does not invent a seeded envelope for null config (board keeps app defaults).
 */
export function resolveProjectBoardRuntime(
  workflowConfig: unknown,
  activeWorkflowId?: string | null
): ProjectBoardRuntime {
  const envelope = parseWorkflowConfigEnvelope(workflowConfig);
  if (envelope) {
    const activeWorkflow = resolveActiveWorkflow(envelope, activeWorkflowId);
    return {
      kind: 'workflow',
      envelope,
      activeWorkflow,
      columns: workflowStatesToBoardColumns(activeWorkflow),
      tabs: listBoardWorkflowTabs(envelope),
    };
  }

  const legacy = boardConfigSchema.safeParse(workflowConfig);
  if (legacy.success) {
    const config = normalizeBoardConfig(legacy.data);
    return {
      kind: 'legacy',
      config,
      columns: config.columns,
    };
  }

  return { kind: 'default' };
}

export function workItemBelongsToActiveWorkflow(
  item: {
    readonly type: WorkItemType;
    readonly state?: unknown;
    readonly status: WorkItemStatus;
  },
  runtime: WorkflowBoardRuntime
): boolean {
  const state = resolveWorkItemState({
    state: item.state,
    status: item.status,
  });
  if (state.workflowId === runtime.activeWorkflow.id) {
    return true;
  }
  const bound = resolveWorkflowForWorkItemType(runtime.envelope, item.type);
  return bound.id === runtime.activeWorkflow.id;
}

export function resolveWorkflowPlacementState(params: {
  readonly workflow: WorkflowDocument;
  readonly previousState: WorkItemState | null;
  readonly targetStateId: string;
  readonly updatedAt: string;
}): WorkItemState | null {
  const target = findWorkflowState(params.workflow, params.targetStateId);
  if (!target) {
    return null;
  }
  const previousHistory = params.previousState?.historyByWorkflow ?? {};
  return {
    workflowId: params.workflow.id,
    stateId: target.id,
    category: target.category,
    historyByWorkflow: {
      ...previousHistory,
      [params.workflow.id]: {
        stateId: target.id,
        updatedAt: params.updatedAt,
      },
    },
  };
}
