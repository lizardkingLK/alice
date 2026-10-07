import { describe, expect, it } from 'vitest';
import { WorkItemStatusEnum } from '@repo/types';
import {
  createSeededDefaultWorkflowConfig,
  findWorkflowEdge,
  resolveProjectBoardRuntime,
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
});
