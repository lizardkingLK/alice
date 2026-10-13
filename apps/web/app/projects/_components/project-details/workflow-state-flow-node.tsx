'use client';

import { memo, useCallback } from 'react';
import {
  WORK_ITEM_STATUSES,
  type WorkItemStatus,
  type WorkflowStateCategory,
} from '@repo/types';
import {
  Handle,
  Position,
  useConnection,
  useStore,
  type Node,
  type NodeProps,
} from '@repo/ui/components/ui/flow-canvas';
import { TruncatedText } from '@repo/ui/components/ui/truncated-text';
import { cn } from '@repo/ui/lib/utils';
import { formatLabelWithSpace } from '@/app/_shared/utility';
import { WORK_ITEM_STATUS_BADGE_STYLES } from '@/app/work-items/_helpers/work-item-status';
import { WORKFLOW_HANDLE } from '@/app/projects/_helpers/workflow-designer.edges';
import type { WorkflowStateNodeData } from '@/app/projects/_helpers/workflow-designer.layout';

/**
 * Lighter board badge surfaces (`WORK_ITEM_STATUS_BADGE_STYLES`).
 * Prefer exact status styles when the state id is a known WorkItemStatus
 * so New / Testing match the kanban columns.
 */
const CATEGORY_CLASS: Record<WorkflowStateCategory, string> = {
  draft: WORK_ITEM_STATUS_BADGE_STYLES.Draft,
  todo: WORK_ITEM_STATUS_BADGE_STYLES.ToDo,
  in_progress: WORK_ITEM_STATUS_BADGE_STYLES.InProgress,
  done: WORK_ITEM_STATUS_BADGE_STYLES.Done,
};

const CATEGORY_CAPTION: Record<WorkflowStateCategory, string> = {
  draft: 'Draft',
  todo: 'To Do',
  in_progress: 'In Progress',
  done: 'Done',
};

const HANDLE_CLASS = 'bg-muted-foreground! size-2! border-background!';

const ALL_HANDLES = [
  {
    id: WORKFLOW_HANDLE.targetLeft,
    type: 'target' as const,
    position: Position.Left,
  },
  {
    id: WORKFLOW_HANDLE.sourceLeft,
    type: 'source' as const,
    position: Position.Left,
  },
  {
    id: WORKFLOW_HANDLE.targetRight,
    type: 'target' as const,
    position: Position.Right,
  },
  {
    id: WORKFLOW_HANDLE.sourceRight,
    type: 'source' as const,
    position: Position.Right,
  },
  {
    id: WORKFLOW_HANDLE.targetTop,
    type: 'target' as const,
    position: Position.Top,
  },
  {
    id: WORKFLOW_HANDLE.sourceTop,
    type: 'source' as const,
    position: Position.Top,
  },
  {
    id: WORKFLOW_HANDLE.targetBottom,
    type: 'target' as const,
    position: Position.Bottom,
  },
  {
    id: WORKFLOW_HANDLE.sourceBottom,
    type: 'source' as const,
    position: Position.Bottom,
  },
] as const;

function isWorkItemStatus(value: string): value is WorkItemStatus {
  return (WORK_ITEM_STATUSES as readonly string[]).includes(value);
}

function nodeSurfaceClass(
  stateId: string,
  category: WorkflowStateCategory
): string {
  if (isWorkItemStatus(stateId)) {
    return WORK_ITEM_STATUS_BADGE_STYLES[stateId];
  }
  return CATEGORY_CLASS[category];
}

function nodeCaption(stateId: string, category: WorkflowStateCategory): string {
  if (isWorkItemStatus(stateId)) {
    return formatLabelWithSpace(stateId);
  }
  return CATEGORY_CAPTION[category];
}

function sameHandleSet(
  a: ReadonlySet<string>,
  b: ReadonlySet<string>
): boolean {
  if (a.size !== b.size) {
    return false;
  }
  for (const id of a) {
    if (!b.has(id)) {
      return false;
    }
  }
  return true;
}

/** Excel-style cut-cell outline (moving dashes). Uses SMIL so it does not depend on CSS layers. */
function MarchingAntsOutline() {
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute inset-0 z-10 h-full w-full overflow-visible"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      <rect
        x="0.75"
        y="0.75"
        width="98.5"
        height="98.5"
        rx="4"
        ry="4"
        fill="none"
        stroke="var(--muted-foreground)"
        strokeWidth="1.5"
        strokeDasharray="4 3"
        pathLength={100}
        vectorEffect="non-scaling-stroke"
      >
        <animate
          attributeName="stroke-dashoffset"
          values="0;-14"
          dur="0.75s"
          repeatCount="indefinite"
        />
      </rect>
    </svg>
  );
}

function WorkflowStateFlowNodeComponent({
  id,
  data,
  selected,
}: NodeProps<Node<WorkflowStateNodeData>>) {
  const connectionInProgress = useConnection(
    (connection) => connection.inProgress
  );
  const selectConnectedHandles = useCallback(
    (state: {
      edges: ReadonlyArray<{
        source: string;
        target: string;
        sourceHandle?: string | null;
        targetHandle?: string | null;
      }>;
    }) => {
      const connected = new Set<string>();
      for (const edge of state.edges) {
        if (edge.source === id && edge.sourceHandle) {
          connected.add(edge.sourceHandle);
        }
        if (edge.target === id && edge.targetHandle) {
          connected.add(edge.targetHandle);
        }
      }
      return connected;
    },
    [id]
  );
  const connectedHandles = useStore(selectConnectedHandles, sameHandleSet);
  const revealAllHandles = selected || connectionInProgress;

  return (
    <div
      className={cn(
        'group relative min-w-37 rounded-md border px-3 py-2 shadow-sm',
        nodeSurfaceClass(id, data.category),
        // Board badges tint label color; designer nodes keep dark body text.
        'text-foreground!'
      )}
    >
      {selected ? <MarchingAntsOutline /> : null}
      {ALL_HANDLES.map((handle) => {
        const isConnected = connectedHandles.has(handle.id);
        return (
          <Handle
            key={handle.id}
            id={handle.id}
            type={handle.type}
            position={handle.position}
            className={cn(
              HANDLE_CLASS,
              'transition-opacity duration-150',
              isConnected || revealAllHandles
                ? 'opacity-100'
                : 'opacity-0 group-hover:opacity-100'
            )}
          />
        );
      })}
      <TruncatedText className="text-foreground text-sm font-medium">
        {data.label}
      </TruncatedText>
      <p className="text-foreground/70 mt-0.5 text-xs">
        {nodeCaption(id, data.category)}
      </p>
    </div>
  );
}

export const WorkflowStateFlowNode = memo(WorkflowStateFlowNodeComponent);
