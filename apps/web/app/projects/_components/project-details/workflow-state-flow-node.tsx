'use client';

import { memo } from 'react';
import type { WorkflowStateCategory } from '@repo/types';
import {
  Handle,
  Position,
  type Node,
  type NodeProps,
} from '@repo/ui/components/ui/flow-canvas';
import { TruncatedText } from '@repo/ui/components/ui/truncated-text';
import { cn } from '@repo/ui/lib/utils';
import type { WorkflowStateNodeData } from '@/app/projects/_helpers/workflow-designer.layout';

const CATEGORY_CLASS: Record<WorkflowStateCategory, string> = {
  draft: 'border-muted-foreground/40 bg-muted/60',
  todo: 'border-border bg-card',
  in_progress: 'border-primary/40 bg-primary/5',
  done: 'border-chart-1/50 bg-chart-1/10',
};

function categoryLabel(category: WorkflowStateCategory): string {
  return category.replaceAll('_', ' ');
}

function WorkflowStateFlowNodeComponent({
  data,
  selected,
}: NodeProps<Node<WorkflowStateNodeData>>) {
  return (
    <div
      className={cn(
        'border-border min-w-[148px] rounded-md border px-3 py-2 shadow-sm',
        CATEGORY_CLASS[data.category],
        selected && 'ring-ring ring-2 ring-offset-1'
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="bg-muted-foreground! size-2!"
      />
      <TruncatedText className="text-foreground text-sm font-medium">
        {data.label}
      </TruncatedText>
      <p className="text-muted-foreground mt-0.5 text-xs capitalize">
        {categoryLabel(data.category)}
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
