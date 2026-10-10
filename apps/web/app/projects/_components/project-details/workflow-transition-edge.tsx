'use client';

import { memo } from 'react';
import {
  BaseEdge,
  getSmoothStepPath,
  type Edge,
  type EdgeProps,
} from '@repo/ui/components/ui/flow-canvas';

const EDGE_STROKE = 'var(--muted-foreground)';

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
}: EdgeProps<Edge>) {
  const [edgePath] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      markerEnd={markerEnd}
      style={{
        ...style,
        stroke: EDGE_STROKE,
        strokeWidth: 1.5,
        ...(selected
          ? {
              strokeDasharray: '5 4',
              animation: 'workflow-marching-ants-stroke 0.75s linear infinite',
            }
          : {}),
      }}
    />
  );
}

export const WorkflowTransitionEdge = memo(WorkflowTransitionEdgeComponent);
