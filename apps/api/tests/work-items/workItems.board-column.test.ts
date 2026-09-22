import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkItemUpdateBody } from '@repo/types/api/v1';
import type { WorkItemRepository } from '../../src/routes/api/workItems/workItems.repository';
import {
  BoardMoveForbiddenError,
  WorkItemAccessError,
  WorkItemValidationError,
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
const ACTOR_UUID = '1559d73c-a39f-452d-a275-e981dedff035';
const OTHER_USER_ID = '2c175370-9c4f-4b0f-a472-1449c74be91e';
const TEAM_ID = '764e1be5-67b4-43dc-a30c-0f66a07ba780';

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

function ruleBoard(
  allowAnyOf: Array<Record<string, string>>,
  fromColumnId = 'development',
  toColumnId = 'code-review'
) {
  return {
    ...CUSTOM_BOARD,
    version: '2',
    transitions: [{ fromColumnId, toColumnId, allowAnyOf }],
  };
}

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

  it('preserves the existing project-access gate before board policy', async () => {
    requireProjectMemberMock.mockRejectedValue(new WorkItemAccessError());

    await expect(
      service.updateWorkItem(ACTOR_ID, WORK_ITEM_ID, updateInput(), LOCK)
    ).rejects.toBeInstanceOf(WorkItemAccessError);

    expect(getProjectWorkflowConfigMock).not.toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
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

  it('allows explicit null on a version 1 board', async () => {
    await expect(
      service.updateWorkItem(
        ACTOR_ID,
        WORK_ITEM_ID,
        updateInput({ board_column_id: null }),
        LOCK
      )
    ).resolves.toMatchObject({ board_column_id: null });

    expect(getProjectWorkflowConfigMock).toHaveBeenCalledWith(PROJECT_ID);
    expect(getBoardActorContextMock).not.toHaveBeenCalled();
  });

  it('allows a version 2 transition when no rule matches the pair', async () => {
    getProjectWorkflowConfigMock.mockResolvedValue({
      ...CUSTOM_BOARD,
      version: '2',
      transitions: [],
    });

    await expect(
      service.updateWorkItem(ACTOR_ID, WORK_ITEM_ID, updateInput(), LOCK)
    ).resolves.toMatchObject({ board_column_id: 'code-review' });
  });

  it('still enforces a same-status board move when status rules are configured', async () => {
    getProjectWorkflowConfigMock.mockResolvedValue({
      ...ruleBoard([{ scope: 'role', role: 'manager' }]),
      statusTransitions: [
        {
          fromStatus: 'ToDo',
          toStatus: 'InProgress',
          allowAnyOf: [{ scope: 'role', role: 'member' }],
        },
      ],
    });

    await expect(
      service.updateWorkItem(ACTOR_ID, WORK_ITEM_ID, updateInput(), LOCK)
    ).rejects.toBeInstanceOf(BoardMoveForbiddenError);

    expect(getBoardActorContextMock).toHaveBeenCalledOnce();
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('allows an exact matching role', async () => {
    getProjectWorkflowConfigMock.mockResolvedValue(
      ruleBoard([{ scope: 'role', role: 'manager' }])
    );
    getBoardActorContextMock.mockResolvedValue({
      role: 'manager',
      isActiveProjectMember: true,
      activeTeamIds: [],
    });

    await expect(
      service.updateWorkItem(ACTOR_ID, WORK_ITEM_ID, updateInput(), LOCK)
    ).resolves.toMatchObject({ board_column_id: 'code-review' });
  });

  it('denies an incorrect role without an automatic admin bypass', async () => {
    getProjectWorkflowConfigMock.mockResolvedValue(
      ruleBoard([{ scope: 'role', role: 'manager' }])
    );
    getBoardActorContextMock.mockResolvedValue({
      role: 'admin',
      isActiveProjectMember: true,
      activeTeamIds: [],
    });

    await expect(
      service.updateWorkItem(ACTOR_ID, WORK_ITEM_ID, updateInput(), LOCK)
    ).rejects.toBeInstanceOf(BoardMoveForbiddenError);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('allows an active same-project team member', async () => {
    getProjectWorkflowConfigMock.mockResolvedValue(
      ruleBoard([{ scope: 'team', teamId: TEAM_ID }])
    );
    getBoardActorContextMock.mockResolvedValue({
      role: 'member',
      isActiveProjectMember: true,
      activeTeamIds: [TEAM_ID],
    });

    await expect(
      service.updateWorkItem(ACTOR_ID, WORK_ITEM_ID, updateInput(), LOCK)
    ).resolves.toMatchObject({ board_column_id: 'code-review' });
    expect(getBoardActorContextMock).toHaveBeenCalledWith(ACTOR_ID, PROJECT_ID);
  });

  it('treats missing or inactive team membership as non-matching', async () => {
    getProjectWorkflowConfigMock.mockResolvedValue(
      ruleBoard([{ scope: 'team', teamId: TEAM_ID }])
    );

    await expect(
      service.updateWorkItem(ACTOR_ID, WORK_ITEM_ID, updateInput(), LOCK)
    ).rejects.toBeInstanceOf(BoardMoveForbiddenError);
  });

  it('allows the configured active project member by public user id', async () => {
    getProjectWorkflowConfigMock.mockResolvedValue(
      ruleBoard([{ scope: 'user', userId: ACTOR_UUID }])
    );

    await expect(
      service.updateWorkItem(ACTOR_UUID, WORK_ITEM_ID, updateInput(), LOCK)
    ).resolves.toMatchObject({ board_column_id: 'code-review' });
  });

  it('denies a different, stale, inactive, or non-project user matcher', async () => {
    getProjectWorkflowConfigMock.mockResolvedValue(
      ruleBoard([{ scope: 'user', userId: OTHER_USER_ID }])
    );
    getBoardActorContextMock.mockResolvedValue(null);

    await expect(
      service.updateWorkItem(ACTOR_UUID, WORK_ITEM_ID, updateInput(), LOCK)
    ).rejects.toBeInstanceOf(BoardMoveForbiddenError);
  });

  it('uses OR semantics across role, team, and user matchers', async () => {
    getProjectWorkflowConfigMock.mockResolvedValue(
      ruleBoard([
        { scope: 'role', role: 'manager' },
        { scope: 'team', teamId: TEAM_ID },
        { scope: 'user', userId: OTHER_USER_ID },
      ])
    );
    getBoardActorContextMock.mockResolvedValue({
      role: 'member',
      isActiveProjectMember: true,
      activeTeamIds: [TEAM_ID],
    });

    await expect(
      service.updateWorkItem(ACTOR_ID, WORK_ITEM_ID, updateInput(), LOCK)
    ).resolves.toMatchObject({ board_column_id: 'code-review' });
  });

  it('denies the transition when all configured references are stale', async () => {
    getProjectWorkflowConfigMock.mockResolvedValue(
      ruleBoard([
        { scope: 'team', teamId: TEAM_ID },
        { scope: 'user', userId: OTHER_USER_ID },
      ])
    );

    await expect(
      service.updateWorkItem(ACTOR_ID, WORK_ITEM_ID, updateInput(), LOCK)
    ).rejects.toBeInstanceOf(BoardMoveForbiddenError);
  });

  it.each([null, 'removed-column'])(
    'uses status fallback for a null or stale source column id (%s)',
    async (boardColumnId) => {
      getByIdMock.mockResolvedValue({
        ...currentWorkItem,
        board_column_id: boardColumnId,
      });
      getProjectWorkflowConfigMock.mockResolvedValue(
        ruleBoard([{ scope: 'role', role: 'manager' }])
      );

      await expect(
        service.updateWorkItem(ACTOR_ID, WORK_ITEM_ID, updateInput(), LOCK)
      ).rejects.toBeInstanceOf(BoardMoveForbiddenError);
    }
  );

  it('enforces a status-only/null-destination move using project fallback', async () => {
    getByIdMock.mockResolvedValue({
      ...currentWorkItem,
      status: 'ToDo',
      board_column_id: 'todo',
    });
    getProjectWorkflowConfigMock.mockResolvedValue(
      ruleBoard([{ scope: 'role', role: 'manager' }], 'todo', 'development')
    );

    await expect(
      service.updateWorkItem(
        ACTOR_ID,
        WORK_ITEM_ID,
        updateInput({ status: 'InProgress', board_column_id: null }),
        LOCK
      )
    ).rejects.toBeInstanceOf(BoardMoveForbiddenError);
    expect(updateMock).not.toHaveBeenCalled();
  });
});
