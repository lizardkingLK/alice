import type { WorkflowNodePosition } from '@/app/projects/_helpers/workflow-designer.layout';

/** Approximate designer node box (matches `min-w-37` + padding). */
export const WORKFLOW_NODE_WIDTH = 148;
export const WORKFLOW_NODE_HEIGHT = 56;

export const WORKFLOW_HANDLE = {
  sourceLeft: 'source-left',
  sourceRight: 'source-right',
  sourceTop: 'source-top',
  sourceBottom: 'source-bottom',
  targetLeft: 'target-left',
  targetRight: 'target-right',
  targetTop: 'target-top',
  targetBottom: 'target-bottom',
} as const;

export type WorkflowEdgeDirection = 'forward' | 'reverse';

export type WorkflowEdgeAnchor = {
  readonly sourceHandle: string;
  readonly targetHandle: string;
  readonly direction: WorkflowEdgeDirection;
  /** Perpendicular path offset so near-parallel edges separate. */
  readonly pathOffset: number;
};

export type WorkflowEdgeHandlePreference = {
  readonly sourceHandle: string;
  readonly targetHandle: string;
};

export const WORKFLOW_EDGE_STROKE = {
  forward: 'var(--muted-foreground)',
  reverse: 'oklch(0.55 0.12 55)',
} as const;

const BASE_PATH_OFFSET = 18;
const PARALLEL_PATH_STEP = 14;

function nodeCenter(position: WorkflowNodePosition): {
  readonly x: number;
  readonly y: number;
} {
  return {
    x: position.x + WORKFLOW_NODE_WIDTH / 2,
    y: position.y + WORKFLOW_NODE_HEIGHT / 2,
  };
}

export function workflowEdgeDirection(
  sourcePosition: WorkflowNodePosition,
  targetPosition: WorkflowNodePosition
): WorkflowEdgeDirection {
  const source = nodeCenter(sourcePosition);
  const target = nodeCenter(targetPosition);
  return target.x - source.x >= 0 ? 'forward' : 'reverse';
}

/**
 * Pick exit/entry sides from relative node centers so vertical and reverse
 * links take short paths instead of always right→left U-turns.
 */
export function resolveWorkflowEdgeAnchor(
  sourcePosition: WorkflowNodePosition,
  targetPosition: WorkflowNodePosition
): Omit<WorkflowEdgeAnchor, 'pathOffset'> {
  const source = nodeCenter(sourcePosition);
  const target = nodeCenter(targetPosition);
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const direction: WorkflowEdgeDirection = dx >= 0 ? 'forward' : 'reverse';

  if (Math.abs(dx) >= Math.abs(dy)) {
    if (dx >= 0) {
      return {
        sourceHandle: WORKFLOW_HANDLE.sourceRight,
        targetHandle: WORKFLOW_HANDLE.targetLeft,
        direction,
      };
    }
    return {
      sourceHandle: WORKFLOW_HANDLE.sourceLeft,
      targetHandle: WORKFLOW_HANDLE.targetRight,
      direction,
    };
  }

  if (dy >= 0) {
    return {
      sourceHandle: WORKFLOW_HANDLE.sourceBottom,
      targetHandle: WORKFLOW_HANDLE.targetTop,
      direction,
    };
  }
  return {
    sourceHandle: WORKFLOW_HANDLE.sourceTop,
    targetHandle: WORKFLOW_HANDLE.targetBottom,
    direction,
  };
}

/**
 * When a forward edge already owns the short corridor, route the return edge
 * on the remaining ports (top↔top or bottom↔bottom) so both directions stay
 * readable as smooth-step paths.
 */
export function resolveReturnEdgeAnchor(
  sourcePosition: WorkflowNodePosition,
  targetPosition: WorkflowNodePosition
): Omit<WorkflowEdgeAnchor, 'pathOffset'> {
  const source = nodeCenter(sourcePosition);
  const target = nodeCenter(targetPosition);
  const dy = target.y - source.y;
  const direction = workflowEdgeDirection(sourcePosition, targetPosition);

  // Prefer the side away from the partner's vertical offset so the return
  // path does not sit on top of the forward corridor.
  if (dy > 0) {
    return {
      sourceHandle: WORKFLOW_HANDLE.sourceTop,
      targetHandle: WORKFLOW_HANDLE.targetTop,
      direction,
    };
  }
  return {
    sourceHandle: WORKFLOW_HANDLE.sourceBottom,
    targetHandle: WORKFLOW_HANDLE.targetBottom,
    direction,
  };
}

type PositionedNode = {
  readonly id: string;
  readonly position: WorkflowNodePosition;
};

type EdgeEndpoints = {
  readonly id: string;
  readonly source: string;
  readonly target: string;
};

type AssignWorkflowEdgeAnchorsOptions = {
  readonly preferredHandles?: ReadonlyMap<string, WorkflowEdgeHandlePreference>;
};

/**
 * Assign smart handles + parallel offsets for every edge from current node
 * positions (used on load and while dragging).
 *
 * Preference order per edge:
 * 1. Explicit handles from the connect gesture (`layout.edges`)
 * 2. Return-path ports when the opposite directed edge exists
 * 3. Shortest facing sides from node centers
 */
export function assignWorkflowEdgeAnchors(
  nodes: ReadonlyArray<PositionedNode>,
  edges: ReadonlyArray<EdgeEndpoints>,
  options?: AssignWorkflowEdgeAnchorsOptions
): ReadonlyMap<string, WorkflowEdgeAnchor> {
  const positionById = new Map(
    nodes.map((node) => [node.id, node.position] as const)
  );
  const opposite = new Set(
    edges.map((edge) => `${edge.target}\0${edge.source}`)
  );
  const preferred = options?.preferredHandles;
  const partial = new Map<
    string,
    Omit<WorkflowEdgeAnchor, 'pathOffset'> & { readonly routeKey: string }
  >();

  for (const edge of edges) {
    const sourcePosition = positionById.get(edge.source);
    const targetPosition = positionById.get(edge.target);
    if (!sourcePosition || !targetPosition) {
      continue;
    }

    const saved = preferred?.get(edge.id);
    let anchor: Omit<WorkflowEdgeAnchor, 'pathOffset'>;
    if (saved?.sourceHandle && saved.targetHandle) {
      anchor = {
        sourceHandle: saved.sourceHandle,
        targetHandle: saved.targetHandle,
        direction: workflowEdgeDirection(sourcePosition, targetPosition),
      };
    } else if (opposite.has(`${edge.source}\0${edge.target}`)) {
      const primary = resolveWorkflowEdgeAnchor(sourcePosition, targetPosition);
      anchor =
        primary.direction === 'reverse'
          ? resolveReturnEdgeAnchor(sourcePosition, targetPosition)
          : primary;
    } else {
      anchor = resolveWorkflowEdgeAnchor(sourcePosition, targetPosition);
    }

    partial.set(edge.id, {
      ...anchor,
      routeKey: `${edge.source}:${anchor.sourceHandle}->${anchor.targetHandle}`,
    });
  }

  const groupIndex = new Map<string, number>();
  const result = new Map<string, WorkflowEdgeAnchor>();

  for (const edge of edges) {
    const item = partial.get(edge.id);
    if (!item) {
      continue;
    }
    const index = groupIndex.get(item.routeKey) ?? 0;
    groupIndex.set(item.routeKey, index + 1);
    result.set(edge.id, {
      sourceHandle: item.sourceHandle,
      targetHandle: item.targetHandle,
      direction: item.direction,
      pathOffset: BASE_PATH_OFFSET + index * PARALLEL_PATH_STEP,
    });
  }

  return result;
}
