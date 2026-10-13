import { describe, expect, it } from 'vitest';
import { createSeededDefaultWorkflowConfig } from '@repo/types';
import { resolveWorkItemStateColumnModel } from '@/app/work-items/_helpers/work-item-state-column';

describe('resolveWorkItemStateColumnModel', () => {
  it('falls back to legacy Status label when there is no workflow', () => {
    const model = resolveWorkItemStateColumnModel({
      status: 'InProgress',
      type: 'Task',
    });

    expect(model.label).toBe('In Progress');
    expect(model.status).toBe('InProgress');
  });

  it('uses the workflow state name when the project has a workflow', () => {
    const workflowConfig = createSeededDefaultWorkflowConfig();
    const firstState = workflowConfig.workflows[0]?.graph.states[0];
    expect(firstState).toBeDefined();

    const model = resolveWorkItemStateColumnModel({
      status: 'New',
      type: 'Task',
      workflowConfig,
      state: {
        workflowId: workflowConfig.workflows[0]!.id,
        stateId: firstState!.id,
        category: firstState!.category,
      },
    });

    expect(model.label).toBe(firstState!.name);
  });
});
