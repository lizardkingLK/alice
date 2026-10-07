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
        onMakeStateTerminal={vi.fn()}
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
        onMakeStateTerminal={vi.fn()}
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

  it('toggles lock record without a confirm dialog', () => {
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
        onMakeStateTerminal={vi.fn()}
      />
    );
    fireEvent.click(screen.getByLabelText(/lock record in this state/i));
    expect(onStateChange).toHaveBeenCalledWith(WorkItemStatusEnum.New, {
      lockRecord: true,
    });
  });

  it('confirms before making a state with outbound edges terminal', () => {
    const workflow = createSeededDefaultWorkflowConfig().workflows[0]!;
    const onMakeStateTerminal = vi.fn();
    render(
      <WorkflowDesignerSettings
        selection={{ kind: 'state', stateId: WorkItemStatusEnum.New }}
        workflow={workflow}
        canEdit
        teams={[]}
        members={[]}
        onStateChange={vi.fn()}
        onEdgeChange={vi.fn()}
        onMakeStateTerminal={onMakeStateTerminal}
      />
    );
    fireEvent.click(screen.getByLabelText(/terminal state/i));
    expect(screen.getByTestId('workflow-terminal-confirm')).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: /remove outbound and lock/i })
    );
    expect(onMakeStateTerminal).toHaveBeenCalledWith(WorkItemStatusEnum.New);
  });

  it('exposes require-children and resolution preset stub for a selected edge', () => {
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
        onMakeStateTerminal={vi.fn()}
      />
    );
    expect(screen.getByTestId('workflow-settings-edge')).toBeInTheDocument();
    expect(screen.getByText(/require children/i)).toBeInTheDocument();
    expect(screen.getByText(/resolution preset/i)).toBeInTheDocument();
    expect(screen.getByText(/who can move/i)).toBeInTheDocument();
  });
});
