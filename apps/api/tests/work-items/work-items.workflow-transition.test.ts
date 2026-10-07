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
  countIncompleteChildrenMock,
  countChildrenNotInTargetStateMock,
} = vi.hoisted(() => ({
  assertCanAccessProjectMock: vi.fn(),
  getByIdMock: vi.fn(),
  getBoardActorContextMock: vi.fn(),
  getProjectWorkflowConfigMock: vi.fn(),
  requireProjectMemberMock: vi.fn(),
  updateMock: vi.fn(),
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
      status: WorkItemStatusEnum.ToDo,
      board_column_id: WorkItemStatusEnum.ToDo,
    });
  });

  it('rejects moves without an edge', async () => {
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
});
