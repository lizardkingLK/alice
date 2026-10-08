import type { ComponentProps } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { WorkItemStatusEnum } from '@repo/types';
import { createSeededDefaultWorkflowConfig } from '@repo/types/api/v1';
import { WorkflowDesignerSettings } from '@/app/projects/_components/project-details/workflow-designer-settings';

function renderSettings(
  overrides: Partial<ComponentProps<typeof WorkflowDesignerSettings>> = {}
) {
  const workflow =
    overrides.workflow ?? createSeededDefaultWorkflowConfig().workflows[0]!;
  const onOpenChange = overrides.onOpenChange ?? vi.fn();
  return {
    onOpenChange,
    ...render(
      <WorkflowDesignerSettings
        selection={null}
        workflow={workflow}
        canEdit
        teams={[]}
        members={[]}
        onStateChange={vi.fn()}
        onEdgeChange={vi.fn()}
        onMakeStateTerminal={vi.fn()}
        open
        onOpenChange={onOpenChange}
        {...overrides}
      />
    ),
  };
}

describe('WorkflowDesignerSettings', () => {
  it('shows workflow summary when nothing is selected', () => {
    renderSettings();
    expect(screen.getByTestId('workflow-settings-empty')).toBeInTheDocument();
    expect(screen.getByText(/active workflow/i)).toBeInTheDocument();
    expect(
      screen.queryByText(/select a state or transition/i)
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/nothing selected/i)).not.toBeInTheDocument();
  });

  it('notifies parent when collapse and expand are clicked', () => {
    const onOpenChange = vi.fn();
    const { rerender } = renderSettings({ onOpenChange });
    fireEvent.click(screen.getByTestId('workflow-designer-settings-collapse'));
    expect(onOpenChange).toHaveBeenCalledWith(false);

    rerender(
      <WorkflowDesignerSettings
        selection={null}
        workflow={createSeededDefaultWorkflowConfig().workflows[0]!}
        canEdit
        teams={[]}
        members={[]}
        onStateChange={vi.fn()}
        onEdgeChange={vi.fn()}
        onMakeStateTerminal={vi.fn()}
        open={false}
        onOpenChange={onOpenChange}
      />
    );
    fireEvent.click(screen.getByTestId('workflow-designer-settings-expand'));
    expect(onOpenChange).toHaveBeenCalledWith(true);
  });

  it('starts collapsed when open is false', () => {
    renderSettings({ open: false });
    expect(
      screen.getByTestId('workflow-designer-settings-expand')
    ).toBeInTheDocument();
  });

  it('edits state name when a state is selected', () => {
    const onStateChange = vi.fn();
    renderSettings({
      selection: { kind: 'state', stateId: WorkItemStatusEnum.New },
      onStateChange,
    });
    expect(screen.getByTestId('workflow-settings-state')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/^name$/i), {
      target: { value: 'Intake' },
    });
    expect(onStateChange).toHaveBeenCalledWith(WorkItemStatusEnum.New, {
      name: 'Intake',
    });
  });

  it('toggles lock record without a confirm dialog', () => {
    const onStateChange = vi.fn();
    renderSettings({
      selection: { kind: 'state', stateId: WorkItemStatusEnum.New },
      onStateChange,
    });
    fireEvent.click(screen.getByLabelText(/lock record in this state/i));
    expect(onStateChange).toHaveBeenCalledWith(WorkItemStatusEnum.New, {
      lockRecord: true,
    });
  });

  it('confirms before making a state with outbound edges terminal', () => {
    const onMakeStateTerminal = vi.fn();
    renderSettings({
      selection: { kind: 'state', stateId: WorkItemStatusEnum.New },
      onMakeStateTerminal,
    });
    fireEvent.click(screen.getByLabelText(/terminal state/i));
    expect(screen.getByTestId('workflow-terminal-confirm')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /remove exits/i }));
    expect(onMakeStateTerminal).toHaveBeenCalledWith(WorkItemStatusEnum.New);
  });

  it('exposes require-children and resolution preset stub for a selected edge', () => {
    const workflow = createSeededDefaultWorkflowConfig().workflows[0]!;
    const edge = workflow.graph.edges[0]!;
    renderSettings({
      selection: { kind: 'edge', edgeId: edge.id },
      workflow,
    });
    expect(screen.getByTestId('workflow-settings-edge')).toBeInTheDocument();
    expect(screen.getByText(/require children/i)).toBeInTheDocument();
    expect(screen.getByText(/resolution preset/i)).toBeInTheDocument();
    expect(screen.getByText(/who can move/i)).toBeInTheDocument();
  });
});
