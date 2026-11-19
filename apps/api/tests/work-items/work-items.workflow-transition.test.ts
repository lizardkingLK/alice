import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkItemStatusEnum } from '@repo/types';
import {
  createSeededDefaultWorkflowConfig,
  type WorkItemUpdateBody,
} from '@repo/types/api/v1';
import type { WorkItemRepository } from '../../src/routes/api/work-items/work-items.repository';
import {
  BoardMoveForbiddenError,
  WorkItemValidationError,
} from '../../src/routes/api/work-items/work-items.errors';
import { WorkItemService } from '../../src/routes/api/work-items/work-items.service';
import type { WorkflowConfigEnvelope } from '@repo/types/api/v1';

vi.mock('../../src/lib/auth-helpers', () => ({
  requireUserWithRole: vi.fn(),
}));

vi.mock('../../src/config/env', () => ({
  env: { STORAGE_BUCKET_ATTACHMENTS: 'attachments' },
}));

vi.mock('../../src/lib/file-helpers', () => ({
  removeStorageObjects: vi.fn(),
}));

const {
  assertCanAccessProjectMock,
  getByIdMock,
  getBoardActorContextMock,
  getProjectWorkflowConfigMock,
  requireProjectMemberMock,
  updateMock,
  updateSprintForDescendantsMock,
  countIncompleteChildrenMock,
  countChildrenNotInTargetStateMock,
} = vi.hoisted(() => ({
  assertCanAccessProjectMock: vi.fn(),
  getByIdMock: vi.fn(),
  getBoardActorContextMock: vi.fn(),
  getProjectWorkflowConfigMock: vi.fn(),
  requireProjectMemberMock: vi.fn(),
  updateMock: vi.fn(),
  updateSprintForDescendantsMock: vi.fn(),
  countIncompleteChildrenMock: vi.fn(),
  countChildrenNotInTargetStateMock: vi.fn(),
}));

const repository = {
  assertCanAccessProject: assertCanAccessProjectMock,
  getById: getByIdMock,
  getBoardActorContext: getBoardActorContextMock,
  getProjectWorkflowConfig: getProjectWorkflowConfigMock,
  requireProjectMember: requireProjectMemberMock,
  update: updateMock,
  updateSprintForDescendants: updateSprintForDescendantsMock,
  countIncompleteChildren: countIncompleteChildrenMock,
  countChildrenNotInTargetState: countChildrenNotInTargetStateMock,
} as unknown as WorkItemRepository;

const service = new WorkItemService(repository);
const ACTOR_ID = 'user-1';
const WORK_ITEM_ID = 'work-item-1';
const PROJECT_ID = 'project-1';
const LOCK = '2026-09-11T00:00:00.000Z';

const currentWorkItem = {
  id: WORK_ITEM_ID,
  project_id: PROJECT_ID,
  title: 'Graph move',
  type: 'Task',
  priority: 'medium',
  assignee_id: null,
  reporter_id: null,
  due_date: null,
  status: WorkItemStatusEnum.New,
  board_column_id: WorkItemStatusEnum.New,
  sprint_id: null,
  story_points: null,
  parent_id: null,
  description: null,
  labels: [],
  jira_issue_key: null,
  state: null,
};

function updateInput(
  overrides: Partial<WorkItemUpdateBody> = {}
): WorkItemUpdateBody {
  return {
    title: currentWorkItem.title,
    project_id: PROJECT_ID,
    type: 'Task',
    priority: 'medium',
    assignee_id: null,
    reporter_id: null,
    due_date: null,
    status: WorkItemStatusEnum.ToDo,
    board_column_id: WorkItemStatusEnum.ToDo,
    sprint_id: null,
    story_points: null,
    parent_id: null,
    description: null,
    labels: [],
    ...overrides,
  };
}

describe('WorkItemService workflow graph transitions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateSprintForDescendantsMock.mockResolvedValue([]);
    requireProjectMemberMock.mockResolvedValue(undefined);
    assertCanAccessProjectMock.mockResolvedValue(undefined);
    getByIdMock.mockResolvedValue(currentWorkItem);
    getProjectWorkflowConfigMock.mockResolvedValue(
      createSeededDefaultWorkflowConfig()
    );
    getBoardActorContextMock.mockResolvedValue({
      role: 'member',
      isActiveProjectMember: true,
      activeTeamIds: [],
    });
    countIncompleteChildrenMock.mockResolvedValue(0);
    countChildrenNotInTargetStateMock.mockResolvedValue(0);
    updateMock.mockImplementation(async (input: WorkItemUpdateBody) => ({
      ...currentWorkItem,
      ...input,
      updated_at: '2026-09-12T00:00:00.000Z',
    }));
  });

  it('allows a seeded forward edge', async () => {
    await expect(
      service.updateWorkItem(ACTOR_ID, WORK_ITEM_ID, updateInput(), LOCK)
    ).resolves.toMatchObject({
      workItem: {
        status: WorkItemStatusEnum.ToDo,
        board_column_id: WorkItemStatusEnum.ToDo,
      },
      cascadedSprintDescendantIds: [],
    });
  });

  it('rejects moves without an edge as not allowed (not a permission error)', async () => {
    let caught: unknown;
    try {
      await service.updateWorkItem(
        ACTOR_ID,
        WORK_ITEM_ID,
        updateInput({
          status: WorkItemStatusEnum.Done,
          board_column_id: WorkItemStatusEnum.Done,
        }),
        LOCK
      );
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(WorkItemValidationError);
    expect(caught).not.toBeInstanceOf(BoardMoveForbiddenError);
    expect((caught as Error).message).toMatch(/not allowed in the workflow/i);
  });

  it('allows a jump to Done when acceptFromAnyState is set', async () => {
    const envelope = createSeededDefaultWorkflowConfig();
    const done = envelope.workflows[0]!.graph.states.find(
      (state) => state.id === WorkItemStatusEnum.Done
    )!;
    done.acceptFromAnyState = true;
    getProjectWorkflowConfigMock.mockResolvedValue(envelope);

    await expect(
      service.updateWorkItem(
        ACTOR_ID,
        WORK_ITEM_ID,
        updateInput({
          status: WorkItemStatusEnum.Done,
          board_column_id: WorkItemStatusEnum.Done,
        }),
        LOCK
      )
    ).resolves.toMatchObject({
      workItem: {
        status: WorkItemStatusEnum.Done,
        board_column_id: WorkItemStatusEnum.Done,
      },
    });
  });

  it('allows a jump from New when allowToAnyState is set', async () => {
    const envelope = createSeededDefaultWorkflowConfig();
    const newState = envelope.workflows[0]!.graph.states.find(
      (state) => state.id === WorkItemStatusEnum.New
    )!;
    newState.allowToAnyState = true;
    getProjectWorkflowConfigMock.mockResolvedValue(envelope);

    await expect(
      service.updateWorkItem(
        ACTOR_ID,
        WORK_ITEM_ID,
        updateInput({
          status: WorkItemStatusEnum.Testing,
          board_column_id: WorkItemStatusEnum.Testing,
        }),
        LOCK
      )
    ).resolves.toMatchObject({
      workItem: {
        status: WorkItemStatusEnum.Testing,
        board_column_id: WorkItemStatusEnum.Testing,
      },
    });
  });

  it('still applies explicit edge rules when a wildcard also matches', async () => {
    const envelope = createSeededDefaultWorkflowConfig();
    const workflow = envelope.workflows[0]!;
    const done = workflow.graph.states.find(
      (state) => state.id === WorkItemStatusEnum.Done
    )!;
    done.acceptFromAnyState = true;
    const edge = workflow.graph.edges.find(
      (item) =>
        item.from === WorkItemStatusEnum.New &&
        item.to === WorkItemStatusEnum.ToDo
    )!;
    edge.allowAnyOf = [{ scope: 'role', role: 'manager' }];
    getProjectWorkflowConfigMock.mockResolvedValue(envelope);

    await expect(
      service.updateWorkItem(ACTOR_ID, WORK_ITEM_ID, updateInput(), LOCK)
    ).rejects.toBeInstanceOf(BoardMoveForbiddenError);
  });

  it('rejects restricted edges with BoardMoveForbiddenError', async () => {
    const envelope = createSeededDefaultWorkflowConfig();
    const workflow = envelope.workflows[0]!;
    const edge = workflow.graph.edges.find(
      (item) =>
        item.from === WorkItemStatusEnum.New &&
        item.to === WorkItemStatusEnum.ToDo
    );
    expect(edge).toBeDefined();
    edge!.allowAnyOf = [{ scope: 'role', role: 'manager' }];
    getProjectWorkflowConfigMock.mockResolvedValue(
      envelope as WorkflowConfigEnvelope
    );

    await expect(
      service.updateWorkItem(ACTOR_ID, WORK_ITEM_ID, updateInput(), LOCK)
    ).rejects.toBeInstanceOf(BoardMoveForbiddenError);
  });

  it('enforces all_complete require-children on Done edges', async () => {
    getByIdMock.mockResolvedValue({
      ...currentWorkItem,
      status: WorkItemStatusEnum.Testing,
      board_column_id: WorkItemStatusEnum.Testing,
    });
    countIncompleteChildrenMock.mockResolvedValue(2);

    await expect(
      service.updateWorkItem(
        ACTOR_ID,
        WORK_ITEM_ID,
        updateInput({
          status: WorkItemStatusEnum.Done,
          board_column_id: WorkItemStatusEnum.Done,
        }),
        LOCK
      )
    ).rejects.toBeInstanceOf(WorkItemValidationError);
  });

  it('allows draft-category destinations via state id and clears board_column_id', async () => {
    const envelope = createSeededDefaultWorkflowConfig();
    const workflow = envelope.workflows[0]!;
    const draftState = workflow.graph.states.find(
      (state) => state.id === WorkItemStatusEnum.New
    )!;
    draftState.name = 'Draft';
    draftState.category = 'draft';
    workflow.graph.edges.push({
      id: 'e-ToDo-to-New',
      from: WorkItemStatusEnum.ToDo,
      to: WorkItemStatusEnum.New,
      allowAnyOf: [],
      requiresEscalation: false,
      resolutionPresetId: null,
      requireChildren: 'off',
      requireLinkedIssues: 'off',
    });
    getProjectWorkflowConfigMock.mockResolvedValue(envelope);
    getByIdMock.mockResolvedValue({
      ...currentWorkItem,
      status: WorkItemStatusEnum.ToDo,
      board_column_id: WorkItemStatusEnum.ToDo,
      state: {
        workflowId: workflow.id,
        stateId: WorkItemStatusEnum.ToDo,
        category: 'todo',
      },
    });

    await expect(
      service.updateWorkItem(
        ACTOR_ID,
        WORK_ITEM_ID,
        updateInput({
          status: WorkItemStatusEnum.Draft,
          board_column_id: WorkItemStatusEnum.New,
        }),
        LOCK
      )
    ).resolves.toMatchObject({
      workItem: { status: WorkItemStatusEnum.New, board_column_id: null },
      cascadedSprintDescendantIds: [],
    });

    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: WorkItemStatusEnum.New,
        board_column_id: null,
        stateOverride: expect.objectContaining({
          stateId: WorkItemStatusEnum.New,
          category: 'draft',
        }),
      })
    );
  });

  it('rejects unknown workflow state ids with a clear message', async () => {
    let caught: unknown;
    try {
      await service.updateWorkItem(
        ACTOR_ID,
        WORK_ITEM_ID,
        updateInput({
          status: WorkItemStatusEnum.ToDo,
          board_column_id: 'st-does-not-exist',
        }),
        LOCK
      );
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(WorkItemValidationError);
    expect((caught as Error).message).toBe(
      'That state is not on this workflow.'
    );
  });
});
