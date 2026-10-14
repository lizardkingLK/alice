import {
  boardColumnIdForWorkflowState,
  categoryFromWorkItemStatus,
  findResolutionPreset,
  findWorkflowById,
  findWorkflowEdge,
  findWorkflowState,
  getResolutionRequirement,
  legacyStatusFromWorkItemState,
  parseWorkflowConfigEnvelope,
  resolveWorkItemState,
  resolveWorkflowForWorkItemType,
  type WorkItemStatus,
  type WorkItemType,
  type WorkflowDocument,
  type WorkflowResolutionPreset,
  type WorkflowStateCategory,
  type WorkflowStateNode,
} from '@repo/types';
import { formatLabelWithSpace } from '@/app/_shared/utility';
import {
  STATUS_INDICATOR_BG,
  STATUS_META,
  type StatusMeta,
  WORK_ITEM_STATUSES,
} from '@/app/work-items/_helpers/work-item-status';

export type WorkflowStateOption = {
  readonly id: string;
  readonly name: string;
  readonly category: WorkflowStateCategory;
  /** Bridged legacy status for API + presentation. */
  readonly status: WorkItemStatus;
};

export type WorkItemStatePickerModel = {
  readonly usesWorkflow: boolean;
  readonly workflow: WorkflowDocument | null;
  readonly options: readonly WorkflowStateOption[];
  readonly currentStateId: string;
  readonly currentLabel: string;
  readonly changeLabel: string;
  readonly fieldLabel: string;
};

const CATEGORY_STATUS_FALLBACK: Record<WorkflowStateCategory, WorkItemStatus> =
  {
    draft: 'Draft',
    todo: 'ToDo',
    in_progress: 'InProgress',
    done: 'Done',
  };

export type StatePresentation = StatusMeta & {
  readonly tintClass: string;
  readonly indicatorClass: string;
};

const STATUS_TINT: Record<string, string> = {
  Draft: 'from-muted-foreground/5',
  New: 'from-blue-500/5',
  ToDo: 'from-slate-500/5',
  InProgress: 'from-amber-500/5',
  Testing: 'from-purple-500/5',
  Done: 'from-emerald-500/5',
};

function optionFromState(
  workflowId: string,
  state: WorkflowStateNode
): WorkflowStateOption {
  return {
    id: state.id,
    name: state.name,
    category: state.category,
    status: legacyStatusFromWorkItemState({
      workflowId,
      stateId: state.id,
      category: state.category,
    }),
  };
}

/** Legacy enum statuses as picker options (projects without a workflow envelope). */
export function legacyWorkflowStateOptions(): readonly WorkflowStateOption[] {
  return WORK_ITEM_STATUSES.map((status) => ({
    id: status,
    name: formatLabelWithSpace(status),
    category: categoryFromWorkItemStatus(status),
    status,
  }));
}

/** Persist null for draft-category destinations; otherwise the state id. */
export function boardColumnIdForStateOption(
  option: Pick<WorkflowStateOption, 'id' | 'category'>
): string | null {
  return boardColumnIdForWorkflowState(option);
}

/**
 * Resolution preset required for a graph move, or null when none applies.
 */
export function resolutionPresetForMove(
  workflow: WorkflowDocument,
  fromStateId: string,
  toStateId: string
): WorkflowResolutionPreset | null {
  const edge = findWorkflowEdge(workflow, fromStateId, toStateId);
  const source = findWorkflowState(workflow, fromStateId);
  if (!edge || !source) {
    return null;
  }
  const requirement = getResolutionRequirement(edge, source);
  if (!requirement.required || !requirement.presetId) {
    return null;
  }
  return findResolutionPreset(workflow, requirement.presetId);
}

/**
 * Resolve picker options for work-item details.
 * Workflow projects list all graph states (including draft); legacy uses enums.
 */
export function resolveWorkItemStatePickerModel(params: {
  readonly workflowConfig: unknown;
  readonly workItemType: WorkItemType | string;
  readonly status: WorkItemStatus;
  readonly state?: unknown;
  readonly boardColumnId?: string | null;
}): WorkItemStatePickerModel {
  const envelope = parseWorkflowConfigEnvelope(params.workflowConfig);
  const resolvedState = resolveWorkItemState({
    state: params.state,
    status: params.status,
    boardColumnId: params.boardColumnId,
  });

  if (!envelope) {
    return {
      usesWorkflow: false,
      workflow: null,
      options: legacyWorkflowStateOptions(),
      currentStateId: params.status,
      currentLabel: formatLabelWithSpace(params.status),
      changeLabel: 'Change Status',
      fieldLabel: 'Status',
    };
  }

  // Prefer the item's persisted graph (matches API PATCH validation); fall
  // back to type bindings / project default for legacy rows.
  const workflow =
    findWorkflowById(envelope, resolvedState.workflowId) ??
    resolveWorkflowForWorkItemType(
      envelope,
      params.workItemType as WorkItemType
    );
  const options = workflow.graph.states.map((state) =>
    optionFromState(workflow.id, state)
  );
  const current =
    options.find((option) => option.id === resolvedState.stateId) ??
    options.find((option) => option.status === params.status) ??
    options[0];

  return {
    usesWorkflow: true,
    workflow,
    options,
    currentStateId: current?.id ?? resolvedState.stateId,
    currentLabel: current?.name ?? formatLabelWithSpace(params.status),
    changeLabel: 'Change state',
    fieldLabel: 'State',
  };
}

/** Icon + color tokens for a workflow state or legacy status. */
export function resolveStatePresentation(params: {
  readonly category?: WorkflowStateCategory | null;
  readonly status?: WorkItemStatus | string | null;
  readonly stateName?: string | null;
}): StatePresentation {
  const statusKey =
    (params.status && STATUS_META[params.status] ? params.status : null) ??
    (params.category ? CATEGORY_STATUS_FALLBACK[params.category] : null) ??
    'ToDo';

  const meta = STATUS_META[statusKey] ?? STATUS_META.ToDo!;
  const label = params.stateName?.trim() || meta.label;

  return {
    label,
    color: meta.color,
    bgClass: meta.bgClass,
    // Keep tinted surfaces; labels/icons stay dark for readability.
    textClass: 'text-foreground',
    borderClass: meta.borderClass,
    icon: meta.icon,
    tintClass: STATUS_TINT[statusKey] ?? STATUS_TINT.ToDo!,
    indicatorClass: STATUS_INDICATOR_BG[statusKey] ?? STATUS_INDICATOR_BG.ToDo!,
  };
}
