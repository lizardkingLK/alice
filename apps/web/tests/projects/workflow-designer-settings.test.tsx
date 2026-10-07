import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { WorkItemStatusEnum } from '@repo/types';
import { createSeededDefaultWorkflowConfig } from '@repo/types/api/v1';
import { WorkflowDesignerSettings } from '@/app/projects/_components/project-details/workflow-designer-settings';

describe('WorkflowDesignerSettings', () => {
  it('shows empty guidance when nothing is selected', () => {
    const workflow = createSeededDefaultWorkflowConfig().workflows[0]!;
    render(
      <WorkflowDesignerSettings
        selection={null}
        workflow={workflow}
        canEdit
        teams={[]}
        members={[]}
        onStateChange={vi.fn()}
        onEdgeChange={vi.fn()}
      />
    );
    expect(screen.getByTestId('workflow-settings-empty')).toBeInTheDocument();
  });

  it('edits state name when a state is selected', () => {
    const workflow = createSeededDefaultWorkflowConfig().workflows[0]!;
    const onStateChange = vi.fn();
    render(
      <WorkflowDesignerSettings
        selection={{ kind: 'state', stateId: WorkItemStatusEnum.New }}
        workflow={workflow}
        canEdit
        teams={[]}
        members={[]}
        onStateChange={onStateChange}
        onEdgeChange={vi.fn()}
      />
    );
    expect(screen.getByTestId('workflow-settings-state')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/^name$/i), {
      target: { value: 'Intake' },
    });
    expect(onStateChange).toHaveBeenCalledWith(WorkItemStatusEnum.New, {
      name: 'Intake',
    });
  });

  it('exposes require-children for a selected edge', () => {
    const workflow = createSeededDefaultWorkflowConfig().workflows[0]!;
    const edge = workflow.graph.edges[0]!;
    render(
      <WorkflowDesignerSettings
        selection={{ kind: 'edge', edgeId: edge.id }}
        workflow={workflow}
        canEdit
        teams={[]}
        members={[]}
        onStateChange={vi.fn()}
        onEdgeChange={vi.fn()}
      />
    );
    expect(screen.getByTestId('workflow-settings-edge')).toBeInTheDocument();
    expect(screen.getByText(/require children/i)).toBeInTheDocument();
    expect(screen.getByText(/who can move/i)).toBeInTheDocument();
  });
});
