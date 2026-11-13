import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReactFlowProvider } from '@repo/ui/components/ui/flow-canvas';
import { WorkflowStateFlowNode } from '@/app/projects/_components/project-details/workflow-state-flow-node';
import type { WorkflowStateNodeData } from '@/app/projects/_helpers/workflow-designer.layout';

vi.mock('@repo/ui/components/ui/flow-canvas', async () => {
  const actual = await vi.importActual<
    typeof import('@repo/ui/components/ui/flow-canvas')
  >('@repo/ui/components/ui/flow-canvas');
  return {
    ...actual,
    Handle: () => null,
  };
});

function renderNode(data: WorkflowStateNodeData) {
  return render(
    <ReactFlowProvider>
      <WorkflowStateFlowNode
        id="st-1"
        type="workflowState"
        data={data}
        selected={false}
        dragging={false}
        zIndex={0}
        selectable
        deletable
        draggable
        isConnectable
        positionAbsoluteX={0}
        positionAbsoluteY={0}
      />
    </ReactFlowProvider>
  );
}

const baseData: WorkflowStateNodeData = {
  label: 'Review',
  category: 'in_progress',
  lockRecord: false,
  terminal: false,
  acceptFromAnyState: false,
  allowToAnyState: false,
};

describe('WorkflowStateFlowNode wildcard chips', () => {
  it('hides chips when neither wildcard flag is set', () => {
    renderNode(baseData);
    expect(screen.queryByTitle('Allow transitions from any state')).toBeNull();
    expect(screen.queryByTitle('Allow transitions to any state')).toBeNull();
  });

  it('shows From any / To any chips when flags are set', () => {
    renderNode({
      ...baseData,
      acceptFromAnyState: true,
      allowToAnyState: true,
    });
    expect(
      screen.getByTitle('Allow transitions from any state')
    ).toHaveTextContent('From any');
    expect(
      screen.getByTitle('Allow transitions to any state')
    ).toHaveTextContent('To any');
  });
});
