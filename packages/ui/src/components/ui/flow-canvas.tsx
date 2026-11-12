'use client';

import type { ComponentProps, ReactNode } from 'react';
import {
  Background,
  BaseEdge,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  SelectionMode,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  getBezierPath,
  getSmoothStepPath,
  reconnectEdge,
  useConnection,
  useEdgesState,
  useNodesState,
  useReactFlow,
  useStore,
  type Connection,
  type Edge,
  type EdgeChange,
  type EdgeProps,
  type Node,
  type NodeChange,
  type NodeProps,
  type OnConnect,
  type OnEdgesChange,
  type OnNodesChange,
  type ReactFlowInstance,
  type ReactFlowProps,
  type XYPosition,
} from '@xyflow/react';

import { cn } from '@repo/ui/lib/utils';

export {
  Background,
  BaseEdge,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  SelectionMode,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  getBezierPath,
  getSmoothStepPath,
  reconnectEdge,
  useConnection,
  useEdgesState,
  useNodesState,
  useReactFlow,
  useStore,
};

export type {
  Connection,
  Edge,
  EdgeChange,
  EdgeProps,
  Node,
  NodeChange,
  NodeProps,
  OnConnect,
  OnEdgesChange,
  OnNodesChange,
  ReactFlowInstance,
  XYPosition,
};

type FlowCanvasProps = Omit<ReactFlowProps, 'children'> & {
  readonly className?: string;
  readonly children?: ReactNode;
  /** When true, wraps with ReactFlowProvider (needed for useReactFlow outside). */
  readonly withProvider?: boolean;
  readonly showBackground?: boolean;
  readonly showControls?: boolean;
  readonly showMiniMap?: boolean;
};

function FlowCanvasInner({
  className,
  children,
  showBackground = true,
  showControls = true,
  showMiniMap = false,
  ...props
}: Omit<FlowCanvasProps, 'withProvider'>) {
  return (
    <div
      data-slot="flow-canvas"
      className={cn('bg-muted/20 h-full min-h-80 w-full', className)}
    >
      <ReactFlow fitView {...props}>
        {showBackground ? <Background gap={16} size={1} /> : null}
        {showControls ? <Controls /> : null}
        {showMiniMap ? <MiniMap pannable zoomable /> : null}
        {children}
      </ReactFlow>
    </div>
  );
}

/**
 * Themed XYFlow / React Flow shell for graph editors.
 * Import styles via `@repo/ui/globals.css` (Tailwind 4 layer).
 */
function FlowCanvas({ withProvider = false, ...props }: FlowCanvasProps) {
  if (withProvider) {
    return (
      <ReactFlowProvider>
        <FlowCanvasInner {...props} />
      </ReactFlowProvider>
    );
  }

  return <FlowCanvasInner {...props} />;
}

export { FlowCanvas };
export type { FlowCanvasProps };
export type FlowCanvasRootProps = ComponentProps<typeof FlowCanvas>;
