import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkItemStatusEnum } from '@repo/types';
import {
  createSeededDefaultWorkflowConfig,
  type WorkItemUpdateBody,
} from '@repo/types/api/v1';
import type { WorkItemRepository } from '../../src/routes/api/work-items/work-items.repository';
import { WorkItemService } from '../../src/routes/api/work-items/work-items.service';
import type { ActivitiesService } from '../../src/routes/api/activities/activities.service';

vi.mock('../../src/lib/auth-helpers', () => ({
  requireUserWithRole: vi.fn(),
}));

vi.mock('../../src/config/env', () => ({
  env: { STORAGE_BUCKET_ATTACHMENTS: 'attachments' },
}));

vi.mock('../../src/lib/file-helpers', () => ({
  removeStorageObjects: vi.fn(),
}));

vi.mock('../../src/lib/prisma', () => ({
  prisma: {
    sprints: { findUnique: vi.fn() },
    users: { findUnique: vi.fn() },
    work_item_worklogs: { create: vi.fn() },
  },
}));

const {
  assertCanAccessProjectMock,
  getByIdMock,
  getBoardActorContextMock,
  getProjectWorkflowConfigMock,
  requireProjectMemberMock,
  updateMock,
  createMock,
  countIncompleteChildrenMock,
  countChildrenNotInTargetStateMock,
  recordCreatedMock,
  recordFieldChangesMock,
  recordWorkflowTransitionMock,
} = vi.hoisted(() => ({
  assertCanAccessProjectMock: vi.fn(),
  getByIdMock: vi.fn(),
  getBoardActorContextMock: vi.fn(),
  getProjectWorkflowConfigMock: vi.fn(),
  requireProjectMemberMock: vi.fn(),
  updateMock: vi.fn(),
  createMock: vi.fn(),
  countIncompleteChildrenMock: vi.fn(),
  countChildrenNotInTargetStateMock: vi.fn(),
  recordCreatedMock: vi.fn(),
  recordFieldChangesMock: vi.fn(),
  recordWorkflowTransitionMock: vi.fn(),
}));

const repository = {
  assertCanAccessProject: assertCanAccessProjectMock,
  getById: getByIdMock,
  getBoardActorContext: getBoardActorContextMock,
  getProjectWorkflowConfig: getProjectWorkflowConfigMock,
  requireProjectMember: requireProjectMemberMock,
  update: updateMock,
  create: createMock,
  countIncompleteChildren: countIncompleteChildrenMock,
  countChildrenNotInTargetState: countChildrenNotInTargetStateMock,
  getProjectAllowedTypes: vi.fn().mockResolvedValue({
    allowedTypes: ['Task', 'Story', 'Epic', 'Feature', 'Issue'],
    hierarchy: null,
  }),
} as unknown as WorkItemRepository;

const activities = {
  recordCreated: recordCreatedMock,
  recordFieldChanges: recordFieldChangesMock,
  recordWorkflowTransition: recordWorkflowTransitionMock,
} as unknown as ActivitiesService;

const service = new WorkItemService(repository, undefined, activities);
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
  record_status: 'active',
  created_at: LOCK,
  updated_at: LOCK,
  created_by: null,
  updated_by: null,
  done_at: null,
};

function baseUpdate(
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

describe('WorkItemService activity writers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireProjectMemberMock.mockResolvedValue(undefined);
    assertCanAccessProjectMock.mockResolvedValue(undefined);
    getByIdMock.mockResolvedValue(currentWorkItem);
    getBoardActorContextMock.mockResolvedValue({
      role: 'member',
      teamIds: [],
      isProjectOwner: false,
    });
    countIncompleteChildrenMock.mockResolvedValue(0);
    countChildrenNotInTargetStateMock.mockResolvedValue(0);
    updateMock.mockResolvedValue({
      ...currentWorkItem,
      status: WorkItemStatusEnum.ToDo,
      board_column_id: WorkItemStatusEnum.ToDo,
    });
    createMock.mockResolvedValue({ ...currentWorkItem, id: 'created-1' });
    recordCreatedMock.mockResolvedValue(undefined);
    recordFieldChangesMock.mockResolvedValue(undefined);
    recordWorkflowTransitionMock.mockResolvedValue(undefined);

    // Spy getProjectAllowedTypes via prototype — service calls private method path
    vi.spyOn(
      WorkItemService.prototype as unknown as {
        getProjectAllowedTypes: (projectId: string) => Promise<unknown>;
      },
      'getProjectAllowedTypes'
    ).mockResolvedValue({
      allowedTypes: ['Task', 'Story', 'Epic', 'Feature', 'Issue'],
      hierarchy: null,
      workflowConfig: createSeededDefaultWorkflowConfig(),
      workflowConfigError: null,
    });
  });

  it('writes created activity on createWorkItem', async () => {
    // Arrange
    const input = {
      title: 'New item',
      project_id: PROJECT_ID,
      type: 'Task' as const,
      priority: 'medium' as const,
      assignee_id: null,
      reporter_id: null,
      due_date: null,
      status: WorkItemStatusEnum.New,
      board_column_id: null,
      sprint_id: null,
      story_points: null,
      parent_id: null,
      description: null,
      labels: [],
    };

    // Act
    await service.createWorkItem(ACTOR_ID, input);

    // Assert
    expect(recordCreatedMock).toHaveBeenCalledWith({
      workItemId: 'created-1',
      actorId: ACTOR_ID,
    });
  });

  it('writes workflow_transition without status field_changed on graph move', async () => {
    // Arrange
    const envelope = createSeededDefaultWorkflowConfig();
    const workflow = envelope.workflows[0]!;
    const fromState = workflow.graph.states.find((s) => s.id === 'New')!;
    const toState = workflow.graph.states.find((s) => s.id === 'ToDo')!;

    getByIdMock.mockResolvedValue({
      ...currentWorkItem,
      status: WorkItemStatusEnum.New,
      board_column_id: fromState.id,
      state: {
        workflowId: workflow.id,
        stateId: fromState.id,
        category: fromState.category,
      },
    });

    // Act
    await service.updateWorkItem(
      ACTOR_ID,
      WORK_ITEM_ID,
      baseUpdate({
        status: WorkItemStatusEnum.ToDo,
        board_column_id: toState.id,
      }),
      LOCK
    );

    // Assert
    expect(recordWorkflowTransitionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        workItemId: WORK_ITEM_ID,
        actorId: ACTOR_ID,
        meta: expect.objectContaining({
          fromStateId: fromState.id,
          toStateId: toState.id,
          workflowId: workflow.id,
        }),
      })
    );
    expect(recordFieldChangesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        changes: expect.not.arrayContaining([
          expect.objectContaining({ field: 'status' }),
        ]),
      })
    );
  });

  it('writes title field_changed on non-status edit', async () => {
    // Arrange
    getProjectWorkflowConfigMock.mockResolvedValue({
      config: null,
      error: null,
    });
    vi.spyOn(
      WorkItemService.prototype as unknown as {
        getProjectAllowedTypes: (projectId: string) => Promise<unknown>;
      },
      'getProjectAllowedTypes'
    ).mockResolvedValue({
      allowedTypes: ['Task', 'Story', 'Epic', 'Feature', 'Issue'],
      hierarchy: null,
      workflowConfig: null,
      workflowConfigError: null,
    });

    // Act
    await service.updateWorkItem(
      ACTOR_ID,
      WORK_ITEM_ID,
      baseUpdate({
        title: 'Renamed',
        status: WorkItemStatusEnum.New,
        board_column_id: WorkItemStatusEnum.New,
      }),
      LOCK
    );

    // Assert
    expect(recordWorkflowTransitionMock).not.toHaveBeenCalled();
    expect(recordFieldChangesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        changes: expect.arrayContaining([
          expect.objectContaining({
            field: 'title',
            oldValue: 'Graph move',
            newValue: 'Renamed',
          }),
        ]),
      })
    );
  });
});
