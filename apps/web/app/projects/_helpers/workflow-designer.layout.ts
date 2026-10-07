import type { WorkflowStateCategory } from '@repo/types';
import type {
  WorkflowConfigEnvelope,
  WorkflowDocument,
  WorkflowEdge,
  WorkflowStateNode,
} from '@repo/types/api/v1';

export const WORKFLOW_STATE_NODE_TYPE = 'workflowState' as const;

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

export type WorkflowFlowEdge = {
  readonly id: string;
  readonly source: string;
  readonly target: string;
  readonly type: 'smoothstep';
  readonly animated: false;
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

  const edges: WorkflowFlowEdge[] = document.graph.edges.map((edge) => ({
    id: edge.id,
    source: edge.from,
    target: edge.to,
    type: 'smoothstep',
    animated: false,
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
  patch: Partial<Pick<WorkflowStateNode, 'name' | 'category' | 'lockRecord' | 'terminal' | 'requiresEscalation'>>
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

export function patchEdgeInDocument(
  document: WorkflowDocument,
  edgeId: string,
  patch: Partial<
    Pick<WorkflowEdge, 'requireChildren' | 'allowAnyOf' | 'resolutionPresetId'>
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
