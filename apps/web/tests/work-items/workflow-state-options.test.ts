import { describe, expect, it } from 'vitest';
import { DEFAULT_WORKFLOW_ID, WorkItemStatusEnum } from '@repo/types';
import { createSeededDefaultWorkflowConfig } from '@repo/types/api/v1';
import {
  boardColumnIdForStateOption,
  legacyWorkflowStateOptions,
  resolveStatePresentation,
  resolveWorkItemStatePickerModel,
} from '@/app/work-items/_helpers/workflow-state-options';

describe('resolveWorkItemStatePickerModel', () => {
  it('lists workflow states including draft-category for envelope projects', () => {
    const envelope = createSeededDefaultWorkflowConfig();
    const draftState = envelope.workflows[0]!.graph.states.find(
      (state) => state.id === WorkItemStatusEnum.New
    )!;
    draftState.category = 'draft';
    draftState.name = 'Draft';

    const model = resolveWorkItemStatePickerModel({
      workflowConfig: envelope,
      workItemType: 'Task',
      status: WorkItemStatusEnum.ToDo,
      boardColumnId: WorkItemStatusEnum.ToDo,
    });

    expect(model.usesWorkflow).toBe(true);
    expect(model.fieldLabel).toBe('State');
    expect(model.changeLabel).toBe('Change state');
    expect(model.options.map((option) => option.id)).toContain(
      WorkItemStatusEnum.New
    );
    expect(
      model.options.find((option) => option.id === WorkItemStatusEnum.New)?.name
    ).toBe('Draft');
  });

  it('prefers the work item persisted workflow over type bindings', () => {
    const envelope = createSeededDefaultWorkflowConfig();
    const bound = structuredClone(envelope.workflows[0]!);
    bound.id = 'wf-bound';
    bound.title = 'Bound';
    bound.typeBindings = ['Task'];
    bound.graph.states = bound.graph.states.map((state) =>
      state.id === WorkItemStatusEnum.New
        ? { ...state, name: 'Bound New' }
        : state
    );
    envelope.workflows.push(bound);

    const model = resolveWorkItemStatePickerModel({
      workflowConfig: envelope,
      workItemType: 'Task',
      status: WorkItemStatusEnum.New,
      state: {
        workflowId: DEFAULT_WORKFLOW_ID,
        stateId: WorkItemStatusEnum.New,
        category: 'todo',
      },
    });

    expect(model.workflow?.id).toBe(DEFAULT_WORKFLOW_ID);
    expect(
      model.options.find((option) => option.id === WorkItemStatusEnum.New)?.name
    ).not.toBe('Bound New');
  });

  it('falls back to legacy status enums without an envelope', () => {
    const model = resolveWorkItemStatePickerModel({
      workflowConfig: null,
      workItemType: 'Task',
      status: WorkItemStatusEnum.InProgress,
    });

    expect(model.usesWorkflow).toBe(false);
    expect(model.fieldLabel).toBe('Status');
    expect(model.currentStateId).toBe(WorkItemStatusEnum.InProgress);
    expect(model.options.some((option) => option.id === 'Draft')).toBe(true);
  });
});

describe('resolveStatePresentation', () => {
  it('uses InProgress amber surface with dark text', () => {
    const presentation = resolveStatePresentation({
      category: 'in_progress',
      stateName: 'Working',
    });

    expect(presentation.label).toBe('Working');
    expect(presentation.bgClass).toContain('amber');
    expect(presentation.textClass).toBe('text-foreground');
  });

  it('includes muted Draft surface with dark text', () => {
    const presentation = resolveStatePresentation({
      status: 'Draft',
      stateName: 'Draft',
    });

    expect(presentation.bgClass).toBe('bg-muted');
    expect(presentation.textClass).toBe('text-foreground');
  });
});

describe('legacyWorkflowStateOptions', () => {
  it('maps enum statuses to picker options', () => {
    const options = legacyWorkflowStateOptions();
    expect(options.some((option) => option.id === 'Draft')).toBe(true);
    expect(
      options.find((option) => option.id === WorkItemStatusEnum.ToDo)?.name
    ).toBe('To Do');
  });
});

describe('boardColumnIdForStateOption', () => {
  it('clears board column for draft category', () => {
    expect(
      boardColumnIdForStateOption({ id: 'New', category: 'draft' })
    ).toBeNull();
    expect(boardColumnIdForStateOption({ id: 'ToDo', category: 'todo' })).toBe(
      'ToDo'
    );
  });
});
