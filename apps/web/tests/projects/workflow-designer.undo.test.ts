import { describe, expect, it } from 'vitest';
import { createSeededDefaultWorkflowConfig } from '@repo/types/api/v1';
import {
  WORKFLOW_UNDO_COALESCE_MS,
  clearWorkflowUndo,
  createWorkflowUndoStack,
  popWorkflowUndo,
  pushWorkflowUndo,
} from '@/app/projects/_helpers/workflow-designer.undo';

describe('workflow-designer.undo', () => {
  it('pops the last pushed envelope snapshot', () => {
    const first = createSeededDefaultWorkflowConfig();
    const second = {
      ...first,
      workflows: first.workflows.map((workflow) => ({
        ...workflow,
        title: 'Edited',
      })),
    };
    let stack = createWorkflowUndoStack();
    stack = pushWorkflowUndo(stack, first);
    stack = pushWorkflowUndo(stack, second);
    const popped = popWorkflowUndo(stack);
    expect(popped?.envelope.workflows[0]?.title).toBe('Edited');
    expect(popWorkflowUndo(popped!.stack)?.envelope.workflows[0]?.title).toBe(
      'Default'
    );
  });

  it('coalesces rapid pushes with the same key', () => {
    const base = createSeededDefaultWorkflowConfig();
    let stack = createWorkflowUndoStack();
    const t0 = 1_000;
    stack = pushWorkflowUndo(stack, base, {
      coalesceKey: 'state-name:New',
      now: t0,
    });
    const mid = {
      ...base,
      workflows: base.workflows.map((workflow) => ({
        ...workflow,
        title: 'Mid',
      })),
    };
    stack = pushWorkflowUndo(stack, mid, {
      coalesceKey: 'state-name:New',
      now: t0 + WORKFLOW_UNDO_COALESCE_MS - 1,
    });
    expect(stack.snapshots).toHaveLength(1);
    expect(stack.snapshots[0]?.workflows[0]?.title).toBe('Default');
  });

  it('clears the stack', () => {
    // eslint-disable-next-line sonarjs/no-dead-store
    let stack = pushWorkflowUndo(
      createWorkflowUndoStack(),
      createSeededDefaultWorkflowConfig()
    );
    stack = clearWorkflowUndo();
    expect(popWorkflowUndo(stack)).toBeNull();
  });
});
