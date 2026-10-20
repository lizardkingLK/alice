import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkItemStatusEnum } from '@repo/types';
import type { WorkItemRepository } from '../../src/routes/api/work-items/work-items.repository';
import { WorkItemAccessError } from '../../src/routes/api/work-items/work-items.errors';
import { WorkItemService } from '../../src/routes/api/work-items/work-items.service';
import { isStatusPlacementOnlyPatch } from '../../src/routes/api/work-items/work-items.patch-utils';

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
  assertCanAccessProjectIdMock,
  getMutationRowByIdMock,
  getBoardActorContextMock,
  getProjectWorkflowConfigMock,
  updateMock,
  requireProjectMemberMock,
  assertCanAccessProjectMock,
  getByIdMock,
} = vi.hoisted(() => ({
  assertCanAccessProjectIdMock: vi.fn(),
  getMutationRowByIdMock: vi.fn(),
  getBoardActorContextMock: vi.fn(),
  getProjectWorkflowConfigMock: vi.fn(),
  updateMock: vi.fn(),
  requireProjectMemberMock: vi.fn(),
  assertCanAccessProjectMock: vi.fn(),
  getByIdMock: vi.fn(),
}));

const repository = {
  assertCanAccessProjectId: assertCanAccessProjectIdMock,
  getMutationRowById: getMutationRowByIdMock,
  getBoardActorContext: getBoardActorContextMock,
  getProjectWorkflowConfig: getProjectWorkflowConfigMock,
  update: updateMock,
  requireProjectMember: requireProjectMemberMock,
  assertCanAccessProject: assertCanAccessProjectMock,
  getById: getByIdMock,
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
  title: 'Board card',
  type: 'Task',
  priority: 'medium',
  assignee_id: null,
  reporter_id: null,
  due_date: null,
  status: WorkItemStatusEnum.InProgress,
  board_column_id: 'development',
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

describe('isStatusPlacementOnlyPatch', () => {
  it('accepts board status bodies', () => {
    expect(
      isStatusPlacementOnlyPatch({
        status: 'InProgress',
        board_column_id: 'code-review',
        expectedUpdatedAt: LOCK,
      })
    ).toBe(true);
  });

  it('rejects full field patches', () => {
    expect(
      isStatusPlacementOnlyPatch({
        status: 'InProgress',
        title: 'Renamed',
        expectedUpdatedAt: LOCK,
      })
    ).toBe(false);
  });
});

describe('WorkItemService.updateWorkItemStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    assertCanAccessProjectIdMock.mockResolvedValue(undefined);
    getMutationRowByIdMock.mockResolvedValue(currentWorkItem);
    getProjectWorkflowConfigMock.mockResolvedValue(CUSTOM_BOARD);
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

  it('uses scoped access + Prisma current row without list-all membership', async () => {
    await service.updateWorkItemStatus(ACTOR_ID, WORK_ITEM_ID, {
      status: WorkItemStatusEnum.InProgress,
      board_column_id: 'code-review',
      expectedUpdatedAt: LOCK,
    });

    expect(getMutationRowByIdMock).toHaveBeenCalledWith(WORK_ITEM_ID);
    expect(assertCanAccessProjectIdMock).toHaveBeenCalledWith(
      ACTOR_ID,
      PROJECT_ID
    );
    expect(requireProjectMemberMock).not.toHaveBeenCalled();
    expect(assertCanAccessProjectMock).not.toHaveBeenCalled();
    expect(getByIdMock).not.toHaveBeenCalled();
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: WorkItemStatusEnum.InProgress,
        board_column_id: 'code-review',
        current: expect.objectContaining({ id: WORK_ITEM_ID }),
      })
    );
  });

  it('loads workflow in parallel with scoped access', async () => {
    let accessStarted = false;
    let workflowStarted = false;
    let bothInFlight = false;

    assertCanAccessProjectIdMock.mockImplementation(async () => {
      accessStarted = true;
      if (workflowStarted) bothInFlight = true;
      await Promise.resolve();
    });
    getProjectWorkflowConfigMock.mockImplementation(async () => {
      workflowStarted = true;
      if (accessStarted) bothInFlight = true;
      return CUSTOM_BOARD;
    });

    await service.updateWorkItemStatus(ACTOR_ID, WORK_ITEM_ID, {
      status: WorkItemStatusEnum.InProgress,
      board_column_id: 'code-review',
      expectedUpdatedAt: LOCK,
    });

    expect(bothInFlight).toBe(true);
  });

  it('rejects when scoped access fails before update', async () => {
    assertCanAccessProjectIdMock.mockRejectedValue(new WorkItemAccessError());

    await expect(
      service.updateWorkItemStatus(ACTOR_ID, WORK_ITEM_ID, {
        status: WorkItemStatusEnum.InProgress,
        board_column_id: 'code-review',
        expectedUpdatedAt: LOCK,
      })
    ).rejects.toBeInstanceOf(WorkItemAccessError);

    expect(updateMock).not.toHaveBeenCalled();
  });

  it('still validates board column placement', async () => {
    await expect(
      service.updateWorkItemStatus(ACTOR_ID, WORK_ITEM_ID, {
        status: WorkItemStatusEnum.InProgress,
        board_column_id: 'missing-column',
        expectedUpdatedAt: LOCK,
      })
    ).rejects.toThrow('Board column does not exist in this project');

    expect(updateMock).not.toHaveBeenCalled();
  });
});
