import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkItemUpdateBody } from '@repo/types/api/v1';
import type { WorkItemRepository } from '../../src/routes/api/workItems/workItems.repository';
import { WorkItemValidationError } from '../../src/routes/api/workItems/workItems.errors';
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
  getProjectWorkflowConfigMock,
  requireProjectMemberMock,
  updateMock,
} = vi.hoisted(() => ({
  assertCanAccessProjectMock: vi.fn(),
  getByIdMock: vi.fn(),
  getProjectWorkflowConfigMock: vi.fn(),
  requireProjectMemberMock: vi.fn(),
  updateMock: vi.fn(),
}));

const repository = {
  assertCanAccessProject: assertCanAccessProjectMock,
  getById: getByIdMock,
  getProjectWorkflowConfig: getProjectWorkflowConfigMock,
  requireProjectMember: requireProjectMemberMock,
  update: updateMock,
} as unknown as WorkItemRepository;

const service = new WorkItemService(repository);
const ACTOR_ID = 'user-1';
const WORK_ITEM_ID = 'work-item-1';
const PROJECT_ID = 'project-1';
const LOCK = '2026-09-11T00:00:00.000Z';

const CUSTOM_BOARD = {
  version: '1',
  columns: [
    { id: 'new', name: 'New', status: 'New' },
    { id: 'todo', name: 'Ready', status: 'ToDo' },
    { id: 'development', name: 'Development', status: 'InProgress' },
    { id: 'code-review', name: 'Code Review', status: 'InProgress' },
    { id: 'testing', name: 'Testing', status: 'Testing' },
    { id: 'done', name: 'Done', status: 'Done' },
  ],
};

const currentWorkItem = {
  id: WORK_ITEM_ID,
  project_id: PROJECT_ID,
  title: 'Persistent placement',
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
    status: 'InProgress',
    board_column_id: 'code-review',
    sprint_id: null,
    story_points: null,
    parent_id: null,
    description: null,
    labels: [],
    jira_issue_key: null,
    ...overrides,
  };
}

describe('WorkItemService board-column validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireProjectMemberMock.mockResolvedValue({ projectId: PROJECT_ID });
    assertCanAccessProjectMock.mockResolvedValue(undefined);
    getByIdMock.mockResolvedValue(currentWorkItem);
    getProjectWorkflowConfigMock.mockResolvedValue(CUSTOM_BOARD);
    updateMock.mockImplementation(async (input) => ({
      ...currentWorkItem,
      ...input,
    }));
  });

  it('persists a valid same-status custom-column move', async () => {
    await expect(
      service.updateWorkItem(ACTOR_ID, WORK_ITEM_ID, updateInput(), LOCK)
    ).resolves.toMatchObject({
      status: 'InProgress',
      board_column_id: 'code-review',
    });

    expect(getProjectWorkflowConfigMock).toHaveBeenCalledWith(PROJECT_ID);
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'InProgress',
        board_column_id: 'code-review',
      })
    );
  });

  it('rejects a column ID missing from the work item project', async () => {
    await expect(
      service.updateWorkItem(
        ACTOR_ID,
        WORK_ITEM_ID,
        updateInput({ board_column_id: 'missing-column' }),
        LOCK
      )
    ).rejects.toThrow('Board column does not exist in this project');

    expect(updateMock).not.toHaveBeenCalled();
  });

  it('rejects a column whose configured status does not match', async () => {
    await expect(
      service.updateWorkItem(
        ACTOR_ID,
        WORK_ITEM_ID,
        updateInput({ status: 'Done', board_column_id: 'code-review' }),
        LOCK
      )
    ).rejects.toThrow('Board column does not match the work item status');

    expect(updateMock).not.toHaveBeenCalled();
  });

  it('does not validate a column against another project configuration', async () => {
    getProjectWorkflowConfigMock.mockResolvedValue({
      version: '1',
      columns: [
        { id: 'new', name: 'New', status: 'New' },
        { id: 'todo', name: 'Ready', status: 'ToDo' },
        { id: 'development', name: 'Development', status: 'InProgress' },
        { id: 'testing', name: 'Testing', status: 'Testing' },
        { id: 'done', name: 'Done', status: 'Done' },
      ],
    });

    await expect(
      service.updateWorkItem(ACTOR_ID, WORK_ITEM_ID, updateInput(), LOCK)
    ).rejects.toBeInstanceOf(WorkItemValidationError);

    expect(getProjectWorkflowConfigMock).toHaveBeenCalledWith(PROJECT_ID);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('allows explicit null without requiring a custom configuration', async () => {
    await expect(
      service.updateWorkItem(
        ACTOR_ID,
        WORK_ITEM_ID,
        updateInput({ board_column_id: null }),
        LOCK
      )
    ).resolves.toMatchObject({ board_column_id: null });

    expect(getProjectWorkflowConfigMock).not.toHaveBeenCalled();
  });
});
