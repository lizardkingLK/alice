import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkItemStatusEnum } from '@repo/types';
import {
  createSeededDefaultWorkflowConfig,
  type WorkItemUpdateBody,
} from '@repo/types/api/v1';
import type { WorkItemRepository } from '../../src/routes/api/work-items/work-items.repository';
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

vi.mock('../../src/lib/prisma', () => ({
  prisma: {
    sprints: { findUnique: vi.fn() },
    users: { findUnique: vi.fn() },
    work_item_worklogs: { create: vi.fn() },
    teams: { findMany: vi.fn().mockResolvedValue([]) },
    work_items: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));

const {
  assertCanAccessProjectMock,
  getByIdMock,
  getBoardActorContextMock,
  requireProjectMemberMock,
  updateMock,
  updateSprintForDescendantsMock,
} = vi.hoisted(() => ({
  assertCanAccessProjectMock: vi.fn(),
  getByIdMock: vi.fn(),
  getBoardActorContextMock: vi.fn(),
  requireProjectMemberMock: vi.fn(),
  updateMock: vi.fn(),
  updateSprintForDescendantsMock: vi.fn(),
}));

const repository = {
  assertCanAccessProject: assertCanAccessProjectMock,
  getById: getByIdMock,
  getBoardActorContext: getBoardActorContextMock,
  requireProjectMember: requireProjectMemberMock,
  update: updateMock,
  updateSprintForDescendants: updateSprintForDescendantsMock,
} as unknown as WorkItemRepository;

const service = new WorkItemService(repository);
const ACTOR_ID = 'user-1';
const WORK_ITEM_ID = 'epic-1';
const CHILD_ID = 'story-1';
const PROJECT_ID = 'project-1';
const SPRINT_ID = 'sprint-1';
const LOCK = '2026-10-12T00:00:00.000Z';

const currentWorkItem = {
  id: WORK_ITEM_ID,
  project_id: PROJECT_ID,
  title: 'UI Implementation',
  type: 'Epic',
  priority: 'medium',
  assignee_id: null,
  reporter_id: null,
  due_date: null,
  status: WorkItemStatusEnum.New,
  board_column_id: null,
  sprint_id: SPRINT_ID,
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
    type: 'Epic',
    priority: 'medium',
    assignee_id: null,
    reporter_id: null,
    due_date: null,
    status: WorkItemStatusEnum.New,
    board_column_id: null,
    sprint_id: SPRINT_ID,
    story_points: null,
    parent_id: null,
    description: null,
    labels: [],
    jira_issue_key: null,
    ...overrides,
  };
}

describe('WorkItemService sprint cascade', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateSprintForDescendantsMock.mockResolvedValue([CHILD_ID]);
    requireProjectMemberMock.mockResolvedValue(undefined);
    assertCanAccessProjectMock.mockResolvedValue(undefined);
    getByIdMock.mockResolvedValue(currentWorkItem);
    getBoardActorContextMock.mockResolvedValue({
      role: 'member',
      teamIds: [],
      isProjectOwner: false,
    });
    updateMock.mockResolvedValue({ ...currentWorkItem });

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

  it('cascades when sprint changes on a root item', async () => {
    getByIdMock.mockResolvedValue({
      ...currentWorkItem,
      sprint_id: null,
    });
    updateMock.mockResolvedValue({
      ...currentWorkItem,
      sprint_id: SPRINT_ID,
    });

    const result = await service.updateWorkItem(
      ACTOR_ID,
      WORK_ITEM_ID,
      updateInput({ sprint_id: SPRINT_ID }),
      LOCK
    );

    expect(updateSprintForDescendantsMock).toHaveBeenCalledWith(
      WORK_ITEM_ID,
      SPRINT_ID,
      ACTOR_ID
    );
    expect(result.cascadedSprintDescendantIds).toEqual([CHILD_ID]);
  });

  it('cascades when cascadeSprint is set even if sprint is unchanged', async () => {
    const result = await service.updateWorkItem(
      ACTOR_ID,
      WORK_ITEM_ID,
      updateInput({ sprint_id: SPRINT_ID }),
      LOCK,
      { cascadeSprint: true }
    );

    expect(updateSprintForDescendantsMock).toHaveBeenCalledWith(
      WORK_ITEM_ID,
      SPRINT_ID,
      ACTOR_ID
    );
    expect(result.cascadedSprintDescendantIds).toEqual([CHILD_ID]);
  });

  it('does not cascade when sprint is unchanged and cascadeSprint is false', async () => {
    const result = await service.updateWorkItem(
      ACTOR_ID,
      WORK_ITEM_ID,
      updateInput({ sprint_id: SPRINT_ID }),
      LOCK
    );

    expect(updateSprintForDescendantsMock).not.toHaveBeenCalled();
    expect(result.cascadedSprintDescendantIds).toEqual([]);
  });

  it('does not cascade for child items', async () => {
    getByIdMock.mockResolvedValue({
      ...currentWorkItem,
      id: CHILD_ID,
      type: 'Story',
      parent_id: WORK_ITEM_ID,
      sprint_id: null,
    });
    updateMock.mockResolvedValue({
      ...currentWorkItem,
      id: CHILD_ID,
      type: 'Story',
      parent_id: WORK_ITEM_ID,
      sprint_id: SPRINT_ID,
    });
    getByIdMock
      .mockResolvedValueOnce({
        ...currentWorkItem,
        id: CHILD_ID,
        type: 'Story',
        parent_id: WORK_ITEM_ID,
        sprint_id: null,
      })
      .mockResolvedValueOnce({
        ...currentWorkItem,
        sprint_id: SPRINT_ID,
      });

    await service.updateWorkItem(
      ACTOR_ID,
      CHILD_ID,
      updateInput({
        type: 'Story',
        parent_id: WORK_ITEM_ID,
        sprint_id: SPRINT_ID,
      }),
      LOCK,
      { cascadeSprint: true }
    );

    expect(updateSprintForDescendantsMock).not.toHaveBeenCalled();
  });
});
