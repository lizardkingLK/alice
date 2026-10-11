import { createPrefixedId, type WorkflowStateCategory } from '@repo/types';
import type {
  WorkflowConfigEnvelope,
  WorkflowDocument,
  WorkflowEdge,
  WorkflowStateNode,
} from '@repo/types/api/v1';
import {
  assignWorkflowEdgeAnchors,
  WORKFLOW_EDGE_STROKE,
  type WorkflowEdgeAnchor,
  type WorkflowEdgeDirection,
  type WorkflowEdgeHandlePreference,
} from '@/app/projects/_helpers/workflow-designer.edges';

export const WORKFLOW_STATE_NODE_TYPE = 'workflowState' as const;
export const WORKFLOW_TRANSITION_EDGE_TYPE = 'workflowTransition' as const;

export type WorkflowNodePosition = {
  readonly x: number;
  readonly y: number;
};

export type WorkflowStateNodeData = {
  readonly label: string;
  readonly category: WorkflowStateCategory;
  readonly lockRecord: boolean;
  readonly terminal: boolean;
};

export type WorkflowFlowNode = {
  readonly id: string;
  readonly type: typeof WORKFLOW_STATE_NODE_TYPE;
  readonly position: WorkflowNodePosition;
  readonly data: WorkflowStateNodeData;
};

export type WorkflowFlowEdgeData = {
  readonly direction: WorkflowEdgeDirection;
  readonly pathOffset: number;
};

export type WorkflowFlowEdge = {
  readonly id: string;
  readonly source: string;
  readonly target: string;
  readonly sourceHandle: string;
  readonly targetHandle: string;
  readonly type: typeof WORKFLOW_TRANSITION_EDGE_TYPE;
  readonly animated: false;
  readonly data: WorkflowFlowEdgeData;
  readonly markerEnd: {
    readonly type: 'arrowclosed';
    readonly width: number;
    readonly height: number;
    readonly color: string;
  };
};

const NODE_GAP_X = 220;
const NODE_GAP_Y = 80;

export function defaultStatePosition(index: number): WorkflowNodePosition {
  return { x: index * NODE_GAP_X, y: NODE_GAP_Y };
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function readLayoutPosition(
  layout: WorkflowDocument['layout'],
  stateId: string,
  index: number
): WorkflowNodePosition {
  const raw = layout.nodes[stateId];
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const record = raw as Record<string, unknown>;
    if (isFiniteNumber(record.x) && isFiniteNumber(record.y)) {
      return { x: record.x, y: record.y };
    }
  }
  return defaultStatePosition(index);
}

function isHandleId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

/** Persisted connect-gesture handles under `layout.edges[edgeId]`. */
export function readLayoutEdgeHandles(
  layout: WorkflowDocument['layout'],
  edgeId: string
): WorkflowEdgeHandlePreference | null {
  const raw = layout.edges[edgeId];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  const record = raw as Record<string, unknown>;
  if (!isHandleId(record.sourceHandle) || !isHandleId(record.targetHandle)) {
    return null;
  }
  return {
    sourceHandle: record.sourceHandle,
    targetHandle: record.targetHandle,
  };
}

export function collectLayoutEdgeHandles(
  layout: WorkflowDocument['layout'],
  edgeIds: ReadonlyArray<string>
): ReadonlyMap<string, WorkflowEdgeHandlePreference> {
  const map = new Map<string, WorkflowEdgeHandlePreference>();
  for (const edgeId of edgeIds) {
    const handles = readLayoutEdgeHandles(layout, edgeId);
    if (handles) {
      map.set(edgeId, handles);
    }
  }
  return map;
}

function withLayoutEdgeHandles(
  document: WorkflowDocument,
  edgeId: string,
  handles: WorkflowEdgeHandlePreference | null
): WorkflowDocument {
  const nextEdges = { ...document.layout.edges };
  if (!handles) {
    delete nextEdges[edgeId];
  } else {
    nextEdges[edgeId] = {
      sourceHandle: handles.sourceHandle,
      targetHandle: handles.targetHandle,
    };
  }
  return {
    ...document,
    layout: {
      ...document.layout,
      edges: nextEdges,
    },
  };
}

export function workflowStateToFlowNode(
  state: WorkflowStateNode,
  position: WorkflowNodePosition
): WorkflowFlowNode {
  return {
    id: state.id,
    type: WORKFLOW_STATE_NODE_TYPE,
    position,
    data: {
      label: state.name,
      category: state.category,
      lockRecord: state.lockRecord,
      terminal: state.terminal,
    },
  };
}

/** Shared edge visual props from a smart/persisted anchor. */
export function workflowFlowEdgePresentation(
  anchor: WorkflowEdgeAnchor | undefined,
  fallbackHandles?: {
    readonly sourceHandle?: string | null;
    readonly targetHandle?: string | null;
  }
): Pick<
  WorkflowFlowEdge,
  'sourceHandle' | 'targetHandle' | 'data' | 'markerEnd'
> {
  const direction = anchor?.direction ?? 'forward';
  const stroke = WORKFLOW_EDGE_STROKE[direction];
  return {
    sourceHandle:
      anchor?.sourceHandle ?? fallbackHandles?.sourceHandle ?? 'source-right',
    targetHandle:
      anchor?.targetHandle ?? fallbackHandles?.targetHandle ?? 'target-left',
    data: {
      direction,
      pathOffset: anchor?.pathOffset ?? 18,
    },
    markerEnd: {
      type: 'arrowclosed',
      width: 20,
      height: 20,
      color: stroke,
    },
  };
}

export function workflowDocumentToFlowElements(document: WorkflowDocument): {
  readonly nodes: WorkflowFlowNode[];
  readonly edges: WorkflowFlowEdge[];
} {
  const nodes = document.graph.states.map((state, index) =>
    workflowStateToFlowNode(
      state,
      readLayoutPosition(document.layout, state.id, index)
    )
  );

  const graphEdges = document.graph.edges.map((edge) => ({
    id: edge.id,
    source: edge.from,
    target: edge.to,
  }));
  const anchors = assignWorkflowEdgeAnchors(nodes, graphEdges, {
    preferredHandles: collectLayoutEdgeHandles(
      document.layout,
      graphEdges.map((edge) => edge.id)
    ),
  });

  const edges: WorkflowFlowEdge[] = document.graph.edges.map((edge) => ({
    id: edge.id,
    source: edge.from,
    target: edge.to,
    type: WORKFLOW_TRANSITION_EDGE_TYPE,
    animated: false,
    ...workflowFlowEdgePresentation(anchors.get(edge.id)),
  }));

  return { nodes, edges };
}

export function applyNodePositionsToDocument(
  document: WorkflowDocument,
  nodes: ReadonlyArray<{
    readonly id: string;
    readonly position: WorkflowNodePosition;
  }>
): WorkflowDocument {
  const nextNodes: Record<string, unknown> = {
    ...document.layout.nodes,
  };

  for (const node of nodes) {
    nextNodes[node.id] = {
      x: node.position.x,
      y: node.position.y,
    };
  }

  return {
    ...document,
    layout: {
      ...document.layout,
      nodes: nextNodes,
    },
  };
}

export function replaceWorkflowInEnvelope(
  envelope: WorkflowConfigEnvelope,
  workflow: WorkflowDocument
): WorkflowConfigEnvelope {
  return {
    ...envelope,
    workflows: envelope.workflows.map((candidate) =>
      candidate.id === workflow.id ? workflow : candidate
    ),
  };
}

export function patchStateInDocument(
  document: WorkflowDocument,
  stateId: string,
  patch: Partial<
    Pick<
      WorkflowStateNode,
      'name' | 'category' | 'lockRecord' | 'terminal' | 'requiresEscalation'
    >
  >
): WorkflowDocument {
  return {
    ...document,
    graph: {
      ...document.graph,
      states: document.graph.states.map((state) =>
        state.id === stateId ? { ...state, ...patch } : state
      ),
    },
  };
}

export function removeOutboundEdgesFromState(
  document: WorkflowDocument,
  stateId: string
): WorkflowDocument {
  return {
    ...document,
    graph: {
      ...document.graph,
      edges: document.graph.edges.filter((edge) => edge.from !== stateId),
    },
  };
}

/** Sets `terminal: true` and removes every outbound edge (never silent). */
export function makeStateTerminalInDocument(
  document: WorkflowDocument,
  stateId: string
): WorkflowDocument {
  return patchStateInDocument(
    removeOutboundEdgesFromState(document, stateId),
    stateId,
    { terminal: true }
  );
}

export function patchEdgeInDocument(
  document: WorkflowDocument,
  edgeId: string,
  patch: Partial<
    Pick<
      WorkflowEdge,
      | 'requireChildren'
      | 'allowAnyOf'
      | 'requiresEscalation'
      | 'resolutionPresetId'
    >
  >
): WorkflowDocument {
  return {
    ...document,
    graph: {
      ...document.graph,
      edges: document.graph.edges.map((edge) =>
        edge.id === edgeId ? { ...edge, ...patch } : edge
      ),
    },
  };
}

export function cloneWorkflowEnvelope(
  envelope: WorkflowConfigEnvelope
): WorkflowConfigEnvelope {
  return structuredClone(envelope);
}

export function envelopesEqualForDesigner(
  left: WorkflowConfigEnvelope,
  right: WorkflowConfigEnvelope
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function createWorkflowStateId(): string {
  return createPrefixedId('st');
}

export function createWorkflowEdgeId(from: string, to: string): string {
  return `e-${from}-to-${to}`;
}

export function canConnectWorkflowStates(
  document: WorkflowDocument,
  from: string,
  to: string
): { readonly ok: true } | { readonly ok: false; readonly reason: string } {
  if (from === to) {
    return { ok: false, reason: 'Self-loop edges are not allowed.' };
  }
  const fromExists = document.graph.states.some((state) => state.id === from);
  const toExists = document.graph.states.some((state) => state.id === to);
  if (!fromExists || !toExists) {
    return { ok: false, reason: 'Both states must exist on this workflow.' };
  }
  const fromState = document.graph.states.find((state) => state.id === from);
  if (fromState?.terminal) {
    return {
      ok: false,
      reason: 'Terminal states cannot have outbound transitions.',
    };
  }
  const duplicate = document.graph.edges.some(
    (edge) => edge.from === from && edge.to === to
  );
  if (duplicate) {
    return { ok: false, reason: 'That transition already exists.' };
  }
  return { ok: true };
}

export function addStateToDocument(
  document: WorkflowDocument,
  options?: {
    readonly name?: string;
    readonly category?: WorkflowStateCategory;
    readonly position?: WorkflowNodePosition;
    readonly lockRecord?: boolean;
    readonly terminal?: boolean;
    readonly requiresEscalation?: boolean;
  }
): {
  readonly document: WorkflowDocument;
  readonly stateId: string;
} {
  const stateId = createWorkflowStateId();
  const index = document.graph.states.length;
  const position = options?.position ?? defaultStatePosition(index);
  const state: WorkflowStateNode = {
    id: stateId,
    name: options?.name?.trim() || 'New state',
    category: options?.category ?? 'todo',
    lockRecord: options?.lockRecord ?? false,
    terminal: options?.terminal ?? false,
    requiresEscalation: options?.requiresEscalation ?? false,
  };

  return {
    stateId,
    document: {
      ...document,
      graph: {
        ...document.graph,
        states: [...document.graph.states, state],
      },
      layout: {
        ...document.layout,
        nodes: {
          ...document.layout.nodes,
          [stateId]: { x: position.x, y: position.y },
        },
      },
    },
  };
}

export function addEdgeToDocument(
  document: WorkflowDocument,
  from: string,
  to: string,
  handles?: WorkflowEdgeHandlePreference | null
):
  | {
      readonly ok: true;
      readonly document: WorkflowDocument;
      readonly edgeId: string;
    }
  | { readonly ok: false; readonly reason: string } {
  const allowed = canConnectWorkflowStates(document, from, to);
  if (!allowed.ok) {
    return allowed;
  }

  const edgeId = createWorkflowEdgeId(from, to);
  const edge: WorkflowEdge = {
    id: edgeId,
    from,
    to,
    allowAnyOf: [],
    requiresEscalation: false,
    resolutionPresetId: null,
    requireChildren: 'off',
  };

  const withGraph: WorkflowDocument = {
    ...document,
    graph: {
      ...document.graph,
      edges: [...document.graph.edges, edge],
    },
  };

  return {
    ok: true,
    edgeId,
    document:
      handles?.sourceHandle && handles.targetHandle
        ? withLayoutEdgeHandles(withGraph, edgeId, handles)
        : withGraph,
  };
}

export function removeStateFromDocument(
  document: WorkflowDocument,
  stateId: string
):
  | { readonly ok: true; readonly document: WorkflowDocument }
  | { readonly ok: false; readonly reason: string } {
  if (document.graph.states.length <= 1) {
    return {
      ok: false,
      reason: 'A workflow needs at least one state.',
    };
  }
  if (!document.graph.states.some((state) => state.id === stateId)) {
    return { ok: false, reason: 'State not found.' };
  }

  const nextNodes = { ...document.layout.nodes };
  delete nextNodes[stateId];
  const removedEdgeIds = new Set(
    document.graph.edges
      .filter((edge) => edge.from === stateId || edge.to === stateId)
      .map((edge) => edge.id)
  );
  const nextEdgeLayout = { ...document.layout.edges };
  for (const edgeId of removedEdgeIds) {
    delete nextEdgeLayout[edgeId];
  }

  return {
    ok: true,
    document: {
      ...document,
      graph: {
        states: document.graph.states.filter((state) => state.id !== stateId),
        edges: document.graph.edges.filter(
          (edge) => edge.from !== stateId && edge.to !== stateId
        ),
      },
      layout: {
        ...document.layout,
        nodes: nextNodes,
        edges: nextEdgeLayout,
      },
    },
  };
}

export function removeEdgeFromDocument(
  document: WorkflowDocument,
  edgeId: string
): WorkflowDocument {
  const nextEdgeLayout = { ...document.layout.edges };
  delete nextEdgeLayout[edgeId];
  return {
    ...document,
    graph: {
      ...document.graph,
      edges: document.graph.edges.filter((edge) => edge.id !== edgeId),
    },
    layout: {
      ...document.layout,
      edges: nextEdgeLayout,
    },
  };
}

export function renameWorkflowInEnvelope(
  envelope: WorkflowConfigEnvelope,
  workflowId: string,
  title: string
): WorkflowConfigEnvelope {
  return {
    ...envelope,
    workflows: envelope.workflows.map((workflow) =>
      workflow.id === workflowId ? { ...workflow, title } : workflow
    ),
  };
}

/** In-memory cut/paste payload — state fields only (no edges). */
export type WorkflowStateClipboard = {
  readonly name: string;
  readonly category: WorkflowStateCategory;
  readonly lockRecord: boolean;
  readonly terminal: boolean;
  readonly requiresEscalation: boolean;
  readonly position: WorkflowNodePosition;
};

const PASTE_OFFSET = 40;

export function captureStateClipboard(
  document: WorkflowDocument,
  stateId: string
): WorkflowStateClipboard | null {
  const state = document.graph.states.find(
    (candidate) => candidate.id === stateId
  );
  if (!state) {
    return null;
  }
  const index = document.graph.states.findIndex(
    (candidate) => candidate.id === stateId
  );
  return {
    name: state.name,
    category: state.category,
    lockRecord: state.lockRecord,
    terminal: state.terminal,
    requiresEscalation: state.requiresEscalation,
    position: readLayoutPosition(document.layout, stateId, Math.max(index, 0)),
  };
}

export function pasteStateFromClipboard(
  document: WorkflowDocument,
  clipboard: WorkflowStateClipboard
): {
  readonly document: WorkflowDocument;
  readonly stateId: string;
} {
  return addStateToDocument(document, {
    name: clipboard.name,
    category: clipboard.category,
    lockRecord: clipboard.lockRecord,
    terminal: clipboard.terminal,
    requiresEscalation: clipboard.requiresEscalation,
    position: {
      x: clipboard.position.x + PASTE_OFFSET,
      y: clipboard.position.y + PASTE_OFFSET,
    },
  });
}

export function isWorkflowDesignerEditableTarget(
  target: EventTarget | null
): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
    return true;
  }
  if (target.isContentEditable) {
    return true;
  }
  return Boolean(target.closest('[contenteditable="true"]'));
}

export function isWorkflowDesignerDialogOpen(): boolean {
  return Boolean(document.querySelector('[role="dialog"][data-state="open"]'));
}
