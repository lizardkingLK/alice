'use client';

import { memo } from 'react';
import {
  WORK_ITEM_STATUSES,
  type WorkItemStatus,
  type WorkflowStateCategory,
} from '@repo/types';
import {
  Handle,
  Position,
  type Node,
  type NodeProps,
} from '@repo/ui/components/ui/flow-canvas';
import { TruncatedText } from '@repo/ui/components/ui/truncated-text';
import { cn } from '@repo/ui/lib/utils';
import { formatLabelWithSpace } from '@/app/_shared/utility';
import { WORK_ITEM_STATUS_BADGE_STYLES } from '@/app/work-items/_helpers/work-item-status';
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
  return (
    <div
      className={cn(
        'relative min-w-37 rounded-md border px-3 py-2 shadow-sm',
        nodeSurfaceClass(id, data.category),
        // Board badges tint label color; designer nodes keep dark body text.
        'text-foreground!'
      )}
    >
      {selected ? <MarchingAntsOutline /> : null}
      <Handle
        type="target"
        position={Position.Left}
        className="bg-muted-foreground! size-2!"
      />
      <TruncatedText className="text-foreground text-sm font-medium">
        {data.label}
      </TruncatedText>
      <p className="text-foreground/70 mt-0.5 text-xs">
        {nodeCaption(id, data.category)}
      </p>
      <Handle
        type="source"
        position={Position.Right}
        className="bg-muted-foreground! size-2!"
      />
    </div>
  );
}

export const WorkflowStateFlowNode = memo(WorkflowStateFlowNodeComponent);
