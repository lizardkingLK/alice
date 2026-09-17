import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkItemUpdateBody } from '@repo/types/api/v1';
import type { WorkItemRepository } from '../../src/routes/api/workItems/workItems.repository';
import {
  BoardMoveForbiddenError,
  StatusTransitionForbiddenError,
} from '../../src/routes/api/workItems/workItems.errors';
import { WorkItemService } from '../../src/routes/api/workItems/workItems.service';

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
} = vi.hoisted(() => ({
  assertCanAccessProjectMock: vi.fn(),
  getByIdMock: vi.fn(),
  getBoardActorContextMock: vi.fn(),
  getProjectWorkflowConfigMock: vi.fn(),
  requireProjectMemberMock: vi.fn(),
  updateMock: vi.fn(),
}));

const repository = {
  assertCanAccessProject: assertCanAccessProjectMock,
  getById: getByIdMock,
  getBoardActorContext: getBoardActorContextMock,
  getProjectWorkflowConfig: getProjectWorkflowConfigMock,
  requireProjectMember: requireProjectMemberMock,
  update: updateMock,
} as unknown as WorkItemRepository;

const service = new WorkItemService(repository);
const ACTOR_ID = 'user-1';
const WORK_ITEM_ID = 'work-item-1';
const PROJECT_ID = 'project-1';
const LOCK = '2026-09-11T00:00:00.000Z';

const COLUMNS = [
  { id: 'new', name: 'New', status: 'New' },
  { id: 'todo', name: 'Ready', status: 'ToDo' },
  { id: 'development', name: 'Development', status: 'InProgress' },
  { id: 'code-review', name: 'Code Review', status: 'InProgress' },
  { id: 'testing', name: 'Testing', status: 'Testing' },
  { id: 'done', name: 'Done', status: 'Done' },
] as const;

const currentWorkItem = {
  id: WORK_ITEM_ID,
  project_id: PROJECT_ID,
  title: 'Status transition',
  type: 'Task',
  priority: 'medium',
  assignee_id: null,
  reporter_id: null,
  due_date: null,
  status: 'ToDo',
  board_column_id: 'todo',
  sprint_id: null,
  story_points: null,
  parent_id: null,
  description: null,
  labels: [],
  jira_issue_key: null,
};

function workflowConfig({
  boardRole,
  statusRole,
  statusFrom = 'ToDo',
  statusTo = 'InProgress',
}: {
  boardRole?: 'admin' | 'manager' | 'member';
  statusRole?: 'admin' | 'manager' | 'member';
  statusFrom?: 'Draft' | 'New' | 'ToDo' | 'InProgress' | 'Testing' | 'Done';
  statusTo?: 'Draft' | 'New' | 'ToDo' | 'InProgress' | 'Testing' | 'Done';
} = {}) {
  return {
    version: '2',
    columns: COLUMNS,
    transitions: boardRole
      ? [
          {
            fromColumnId: 'todo',
            toColumnId: 'development',
            allowAnyOf: [{ scope: 'role', role: boardRole }],
          },
        ]
      : [],
    statusTransitions: statusRole
      ? [
          {
            fromStatus: statusFrom,
            toStatus: statusTo,
            allowAnyOf: [{ scope: 'role', role: statusRole }],
          },
        ]
      : [],
  };
}

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
    status: 'InProgress',
    board_column_id: 'development',
    sprint_id: null,
    story_points: null,
    parent_id: null,
    description: null,
    labels: [],
    jira_issue_key: null,
    ...overrides,
  };
}

describe('WorkItemService status-transition validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireProjectMemberMock.mockResolvedValue({ projectId: PROJECT_ID });
    assertCanAccessProjectMock.mockResolvedValue(undefined);
    getByIdMock.mockResolvedValue(currentWorkItem);
    getBoardActorContextMock.mockResolvedValue({
      role: 'member',
      isActiveProjectMember: true,
      activeTeamIds: [],
    });
    updateMock.mockImplementation(async (input) => ({
      ...currentWorkItem,
      ...input,
    }));
  });

  it('allows a configured status transition when the actor matches', async () => {
    getProjectWorkflowConfigMock.mockResolvedValue(
      workflowConfig({ statusRole: 'member' })
    );

    await expect(
      service.updateWorkItem(ACTOR_ID, WORK_ITEM_ID, updateInput(), LOCK)
    ).resolves.toMatchObject({ status: 'InProgress' });

    expect(getBoardActorContextMock).toHaveBeenCalledOnce();
    expect(updateMock).toHaveBeenCalledOnce();
  });

  it('blocks a configured status transition when the actor does not match', async () => {
    getProjectWorkflowConfigMock.mockResolvedValue(
      workflowConfig({ statusRole: 'manager' })
    );

    await expect(
      service.updateWorkItem(ACTOR_ID, WORK_ITEM_ID, updateInput(), LOCK)
    ).rejects.toBeInstanceOf(StatusTransitionForbiddenError);
  });

  it('allows a status change when there is no exact configured status rule', async () => {
    getProjectWorkflowConfigMock.mockResolvedValue(
      workflowConfig({
        statusRole: 'manager',
        statusFrom: 'New',
        statusTo: 'ToDo',
      })
    );

    await expect(
      service.updateWorkItem(ACTOR_ID, WORK_ITEM_ID, updateInput(), LOCK)
    ).resolves.toMatchObject({ status: 'InProgress' });

    expect(getBoardActorContextMock).not.toHaveBeenCalled();
  });

  it('allows a combined status and board change when both rules pass', async () => {
    getProjectWorkflowConfigMock.mockResolvedValue(
      workflowConfig({ boardRole: 'member', statusRole: 'member' })
    );

    await expect(
      service.updateWorkItem(ACTOR_ID, WORK_ITEM_ID, updateInput(), LOCK)
    ).resolves.toMatchObject({
      status: 'InProgress',
      board_column_id: 'development',
    });
  });

  it('keeps board-rule failure precedence when status passes', async () => {
    getProjectWorkflowConfigMock.mockResolvedValue(
      workflowConfig({ boardRole: 'manager', statusRole: 'member' })
    );

    await expect(
      service.updateWorkItem(ACTOR_ID, WORK_ITEM_ID, updateInput(), LOCK)
    ).rejects.toBeInstanceOf(BoardMoveForbiddenError);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('blocks with the status error when board passes but status fails', async () => {
    getProjectWorkflowConfigMock.mockResolvedValue(
      workflowConfig({ boardRole: 'member', statusRole: 'manager' })
    );

    await expect(
      service.updateWorkItem(ACTOR_ID, WORK_ITEM_ID, updateInput(), LOCK)
    ).rejects.toBeInstanceOf(StatusTransitionForbiddenError);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('loads workflow config and actor context once when both rules exist', async () => {
    getProjectWorkflowConfigMock.mockResolvedValue(
      workflowConfig({ boardRole: 'member', statusRole: 'member' })
    );

    await service.updateWorkItem(ACTOR_ID, WORK_ITEM_ID, updateInput(), LOCK);

    expect(getProjectWorkflowConfigMock).toHaveBeenCalledOnce();
    expect(getBoardActorContextMock).toHaveBeenCalledOnce();
    expect(getBoardActorContextMock).toHaveBeenCalledWith(ACTOR_ID, PROJECT_ID);
  });

  it('does not update the repository after failed status validation', async () => {
    getProjectWorkflowConfigMock.mockResolvedValue(
      workflowConfig({ statusRole: 'manager' })
    );

    await expect(
      service.updateWorkItem(ACTOR_ID, WORK_ITEM_ID, updateInput(), LOCK)
    ).rejects.toBeInstanceOf(StatusTransitionForbiddenError);

    expect(updateMock).not.toHaveBeenCalled();
  });
});
