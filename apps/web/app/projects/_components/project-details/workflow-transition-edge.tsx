'use client';

import { memo } from 'react';
import {
  BaseEdge,
  getSmoothStepPath,
  type Edge,
  type EdgeProps,
} from '@repo/ui/components/ui/flow-canvas';
import {
  WORKFLOW_EDGE_STROKE,
  type WorkflowEdgeDirection,
} from '@/app/projects/_helpers/workflow-designer.edges';

type TransitionEdgeData = {
  readonly direction?: WorkflowEdgeDirection;
  readonly pathOffset?: number;
};

function WorkflowTransitionEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  selected,
  style,
  markerEnd,
  data,
}: EdgeProps<Edge<TransitionEdgeData>>) {
  const direction = data?.direction ?? 'forward';
  const pathOffset = data?.pathOffset ?? 18;
  const stroke = WORKFLOW_EDGE_STROKE[direction];

  const [edgePath] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    offset: pathOffset,
  });

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      markerEnd={markerEnd}
      style={{
        ...style,
        stroke,
        strokeWidth: 1.5,
        // Inline animation — BaseEdge applies `style` on the path; className alone
        // does not reliably animate. Dash period 4+3 matches keyframe -14 (2 cycles).
        ...(selected
          ? {
              strokeDasharray: '4 3',
              animation: 'workflow-marching-ants-stroke 0.75s linear infinite',
            }
          : {}),
      }}
    />
  );
}

export const WorkflowTransitionEdge = memo(WorkflowTransitionEdgeComponent);
