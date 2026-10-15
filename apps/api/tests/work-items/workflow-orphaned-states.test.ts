import { describe, expect, it } from 'vitest';
import {
  DEFAULT_WORKFLOW_ID,
  WorkItemStatusEnum,
  buildAvailableStatesByWorkflow,
  buildWorkflowOrphanedStatesConflict,
  createSeededDefaultWorkflowConfig,
  listRemovedWorkflowStates,
  suggestRemapTargetState,
  validateWorkflowStateRemaps,
} from '@repo/types';

describe('workflow orphaned states helpers', () => {
  it('lists states removed from a surviving workflow', () => {
    const previous = createSeededDefaultWorkflowConfig();
    const next = createSeededDefaultWorkflowConfig();
    next.workflows[0] = {
      ...next.workflows[0]!,
      graph: {
        ...next.workflows[0]!.graph,
        states: next.workflows[0]!.graph.states.filter(
          (state) => state.id !== WorkItemStatusEnum.ToDo
        ),
        edges: next.workflows[0]!.graph.edges.filter(
          (edge) =>
            edge.from !== WorkItemStatusEnum.ToDo &&
            edge.to !== WorkItemStatusEnum.ToDo
        ),
      },
    };

    const removed = listRemovedWorkflowStates(previous, next);

    expect(removed).toEqual([
      expect.objectContaining({
        workflowId: DEFAULT_WORKFLOW_ID,
        stateId: WorkItemStatusEnum.ToDo,
      }),
    ]);
  });

  it('requires remaps for every affected removed state', () => {
    const next = createSeededDefaultWorkflowConfig();
    const groups = [
      {
        workflowId: DEFAULT_WORKFLOW_ID,
        workflowTitle: 'Default',
        stateId: WorkItemStatusEnum.ToDo,
        stateName: 'To Do',
        category: 'todo' as const,
        affectedCount: 2,
      },
    ];

    expect(
      validateWorkflowStateRemaps({
        next,
        removedWithCounts: groups,
        remaps: [],
      }).ok
    ).toBe(false);

    expect(
      validateWorkflowStateRemaps({
        next,
        removedWithCounts: groups,
        remaps: [
          {
            workflowId: DEFAULT_WORKFLOW_ID,
            fromStateId: WorkItemStatusEnum.ToDo,
            toStateId: WorkItemStatusEnum.InProgress,
          },
        ],
      })
    ).toEqual({ ok: true });
  });

  it('suggests a same-category remaining state when possible', () => {
    const available = buildAvailableStatesByWorkflow(
      createSeededDefaultWorkflowConfig(),
      [DEFAULT_WORKFLOW_ID]
    )[DEFAULT_WORKFLOW_ID]!;

    const suggested = suggestRemapTargetState(available, 'todo');
    expect(suggested?.category).toBe('todo');
  });

  it('builds a conflict payload with totals', () => {
    const conflict = buildWorkflowOrphanedStatesConflict({
      groups: [
        {
          workflowId: DEFAULT_WORKFLOW_ID,
          workflowTitle: 'Default',
          stateId: WorkItemStatusEnum.ToDo,
          stateName: 'To Do',
          category: 'todo',
          affectedCount: 3,
        },
      ],
      availableStatesByWorkflow: {
        [DEFAULT_WORKFLOW_ID]: [
          {
            id: WorkItemStatusEnum.New,
            name: 'New',
            category: 'todo',
          },
        ],
      },
    });

    expect(conflict.totalAffected).toBe(3);
    expect(conflict.code).toBe('WORKFLOW_ORPHANED_STATES');
    expect(conflict.message).toContain('3 work items');
  });
});
