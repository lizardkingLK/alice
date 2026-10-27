import { describe, expect, it } from 'vitest';
import { WorkItemStatusEnum } from '@repo/types';
import {
  boardColumnIdForWorkflowState,
  createSeededDefaultWorkflowConfig,
  findWorkflowEdge,
  resolveProjectBoardRuntime,
  resolveWorkflowGraphState,
  resolveWorkflowTransition,
  workflowStatesToBoardColumns,
} from '@repo/types/api/v1';

describe('board-runtime', () => {
  it('maps seeded workflow states to board columns', () => {
    const envelope = createSeededDefaultWorkflowConfig();
    const columns = workflowStatesToBoardColumns(envelope.workflows[0]!);
    expect(columns.map((column) => column.id)).toEqual([
      WorkItemStatusEnum.New,
      WorkItemStatusEnum.ToDo,
      WorkItemStatusEnum.InProgress,
      WorkItemStatusEnum.Testing,
      WorkItemStatusEnum.Done,
    ]);
    expect(columns[0]?.name).toBe('New');
  });

  it('resolves a persisted envelope as workflow runtime', () => {
    const envelope = createSeededDefaultWorkflowConfig();
    const runtime = resolveProjectBoardRuntime(
      envelope,
      envelope.defaultWorkflowId
    );
    expect(runtime.kind).toBe('workflow');
    if (runtime.kind !== 'workflow') {
      return;
    }
    expect(runtime.activeWorkflow.id).toBe(envelope.defaultWorkflowId);
    expect(runtime.columns.length).toBeGreaterThan(0);
    expect(runtime.tabs).toHaveLength(1);
  });

  it('falls back to legacy board config when envelope is absent', () => {
    const runtime = resolveProjectBoardRuntime({
      version: '1',
      columns: [
        { id: 'new', name: 'New', status: 'New' },
        { id: 'todo', name: 'To Do', status: 'ToDo' },
        { id: 'in-progress', name: 'In Progress', status: 'InProgress' },
        { id: 'testing', name: 'Testing', status: 'Testing' },
        { id: 'done', name: 'Done', status: 'Done' },
      ],
    });
    expect(runtime.kind).toBe('legacy');
  });

  it('returns default when config is null', () => {
    expect(resolveProjectBoardRuntime(null).kind).toBe('default');
  });

  it('finds workflow edges by from/to', () => {
    const workflow = createSeededDefaultWorkflowConfig().workflows[0]!;
    const edge = findWorkflowEdge(
      workflow,
      WorkItemStatusEnum.New,
      WorkItemStatusEnum.ToDo
    );
    expect(edge?.id).toBe('e-New-to-ToDo');
    expect(
      findWorkflowEdge(
        workflow,
        WorkItemStatusEnum.Done,
        WorkItemStatusEnum.New
      )
    ).toBeNull();
  });

  it('resolves accept-from-any and allow-to-any wildcards', () => {
    const workflow = createSeededDefaultWorkflowConfig().workflows[0]!;
    const done = workflow.graph.states.find(
      (state) => state.id === WorkItemStatusEnum.Done
    )!;
    done.acceptFromAnyState = true;

    const intoDone = resolveWorkflowTransition(
      workflow,
      WorkItemStatusEnum.New,
      WorkItemStatusEnum.Done
    );
    expect(intoDone).toMatchObject({
      viaWildcard: true,
      edge: {
        from: WorkItemStatusEnum.New,
        to: WorkItemStatusEnum.Done,
        allowAnyOf: [],
        requireChildren: 'off',
      },
    });

    const explicit = resolveWorkflowTransition(
      workflow,
      WorkItemStatusEnum.Testing,
      WorkItemStatusEnum.Done
    );
    expect(explicit).toMatchObject({
      viaWildcard: false,
      edge: { id: 'e-Testing-to-Done' },
    });

    const newState = workflow.graph.states.find(
      (state) => state.id === WorkItemStatusEnum.New
    )!;
    newState.allowToAnyState = true;
    const fromNew = resolveWorkflowTransition(
      workflow,
      WorkItemStatusEnum.New,
      WorkItemStatusEnum.Testing
    );
    expect(fromNew?.viaWildcard).toBe(true);

    done.terminal = true;
    done.allowToAnyState = true;
    expect(
      resolveWorkflowTransition(
        workflow,
        WorkItemStatusEnum.Done,
        WorkItemStatusEnum.New
      )
    ).toBeNull();
  });

  it('resolves draft-category states omitted from board columns', () => {
    const workflow = createSeededDefaultWorkflowConfig().workflows[0]!;
    const draftState = workflow.graph.states.find(
      (state) => state.id === WorkItemStatusEnum.New
    )!;
    draftState.category = 'draft';
    draftState.name = 'Draft';

    expect(
      workflowStatesToBoardColumns(workflow).map((column) => column.id)
    ).not.toContain(WorkItemStatusEnum.New);

    expect(
      resolveWorkflowGraphState({
        workflow,
        status: WorkItemStatusEnum.Draft,
        board_column_id: WorkItemStatusEnum.New,
      })?.id
    ).toBe(WorkItemStatusEnum.New);

    expect(boardColumnIdForWorkflowState(draftState)).toBeNull();
    expect(
      boardColumnIdForWorkflowState({
        id: WorkItemStatusEnum.ToDo,
        category: 'todo',
      })
    ).toBe(WorkItemStatusEnum.ToDo);
  });
});
