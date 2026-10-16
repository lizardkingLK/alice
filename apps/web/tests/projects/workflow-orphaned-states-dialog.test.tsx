import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  WORKFLOW_ORPHANED_STATES_CODE,
  type WorkflowOrphanedStatesConflict,
} from '@repo/types/api/v1';
import { WorkflowOrphanedStatesDialog } from '@/app/projects/_components/project-details/workflow-orphaned-states-dialog';

const conflict: WorkflowOrphanedStatesConflict = {
  code: WORKFLOW_ORPHANED_STATES_CODE,
  message:
    '2 work items still use "To Do". Move them to another state or discard your changes.',
  totalAffected: 2,
  groups: [
    {
      workflowId: 'wf-default',
      workflowTitle: 'Default',
      stateId: 'ToDo',
      stateName: 'To Do',
      category: 'todo',
      affectedCount: 2,
    },
  ],
  availableStatesByWorkflow: {
    'wf-default': [
      { id: 'New', name: 'New', category: 'todo' },
      { id: 'InProgress', name: 'In Progress', category: 'in_progress' },
    ],
  },
};

describe('WorkflowOrphanedStatesDialog', () => {
  it('confirms remaps for each removed state', async () => {
    const onConfirmRemap = vi.fn();
    render(
      <WorkflowOrphanedStatesDialog
        conflict={conflict}
        open
        isSaving={false}
        onOpenChange={vi.fn()}
        onDiscard={vi.fn()}
        onConfirmRemap={onConfirmRemap}
      />
    );

    expect(
      screen.getByTestId('workflow-orphaned-states-dialog')
    ).toBeInTheDocument();
    const saveButton = screen.getByRole('button', { name: /move and save/i });
    await waitFor(() => {
      expect(saveButton).toBeEnabled();
    });
    fireEvent.click(saveButton);

    expect(onConfirmRemap).toHaveBeenCalledWith([
      {
        workflowId: 'wf-default',
        fromStateId: 'ToDo',
        toStateId: 'New',
      },
    ]);
  });

  it('discards without remapping', () => {
    const onDiscard = vi.fn();
    render(
      <WorkflowOrphanedStatesDialog
        conflict={conflict}
        open
        isSaving={false}
        onOpenChange={vi.fn()}
        onDiscard={onDiscard}
        onConfirmRemap={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /discard changes/i }));
    expect(onDiscard).toHaveBeenCalled();
  });
});
