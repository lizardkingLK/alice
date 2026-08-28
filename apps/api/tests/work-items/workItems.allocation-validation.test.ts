/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkItemService } from '../../src/routes/api/workItems/workItems.service';
import { WorkItemValidationError } from '../../src/routes/api/workItems/workItems.errors';

const {
  findManyTeamsMock,
  findManyWorkItemsMock,
  findUniqueSprintMock,
  findUniqueUserMock,
  createWorklogMock,
} = vi.hoisted(() => ({
  findManyTeamsMock: vi.fn(),
  findManyWorkItemsMock: vi.fn(),
  findUniqueSprintMock: vi.fn(),
  findUniqueUserMock: vi.fn(),
  createWorklogMock: vi.fn(),
}));

vi.mock('../../src/config/env', () => ({
  env: {
    STORAGE_BUCKET_ATTACHMENTS: 'attachments',
    SUPABASE_URL: 'https://placeholder-project.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'placeholder-key',
  },
}));

vi.mock('../../src/lib/prisma', () => ({
  prisma: {
    teams: {
      findMany: findManyTeamsMock,
    },
    work_items: {
      findMany: findManyWorkItemsMock,
    },
    sprints: {
      findUnique: findUniqueSprintMock,
    },
    users: {
      findUnique: findUniqueUserMock,
    },
    work_item_worklogs: {
      create: createWorklogMock,
    },
  },
}));

const mockRepo = {
  assertCanAccessProject: vi.fn(),
  assertValidParentLink: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  getById: vi.fn(),
  requireProjectMember: vi.fn(),
} as any;

const service = new WorkItemService(mockRepo);

const VALID_PROJECT_ID = 'd9b0a1a5-827d-4bdf-87f5-19e48d3db09b';
const VALID_SPRINT_ID = 'e9b0a1a5-827d-4bdf-87f5-19e48d3db09c';
const VALID_ASSIGNEE_ID = 'f9b0a1a5-827d-4bdf-87f5-19e48d3db09d';

describe('WorkItemService allocation validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('bypasses validation if no sprint_id is set', async () => {
    mockRepo.assertCanAccessProject.mockResolvedValue(undefined);
    mockRepo.create.mockResolvedValue({ id: 'wi-1' });

    const input = {
      project_id: VALID_PROJECT_ID,
      title: 'Backlog Item',
      type: 'Task' as const,
      assignee_id: null,
      due_date: null,
    };

    await expect(service.createWorkItem('user-1', input)).resolves.toEqual({ id: 'wi-1' });
    expect(findManyTeamsMock).not.toHaveBeenCalled();
  });

  it('validates sprint capacity successfully', async () => {
    // 1 active member with capacity 40, allocation 100 -> sprint capacity = 40.
    findManyTeamsMock.mockResolvedValue([
      {
        members: [
          { user_id: VALID_ASSIGNEE_ID, capacity: 40, allocation: 100, status: 'active' },
        ],
      },
    ]);
    // Current sprint allocation: 30 story points.
    findManyWorkItemsMock.mockResolvedValue([
      { story_points: 30 },
    ]);
    // Proposed work item has 5 story points -> 35 <= 40 -> allowed.
    mockRepo.create.mockResolvedValue({ id: 'wi-1' });

    const input = {
      project_id: VALID_PROJECT_ID,
      sprint_id: VALID_SPRINT_ID,
      story_points: 5,
      title: 'Sprint Item',
      type: 'Task' as const,
      assignee_id: null,
      due_date: null,
    };

    await expect(service.createWorkItem('user-1', input)).resolves.toEqual({ id: 'wi-1' });
  });

  it('fails sprint capacity validation when exceeded', async () => {
    // Sprint capacity = 40.
    findManyTeamsMock.mockResolvedValue([
      {
        members: [
          { user_id: VALID_ASSIGNEE_ID, capacity: 40, allocation: 100, status: 'active' },
        ],
      },
    ]);
    // Current sprint allocation: 30.
    findManyWorkItemsMock.mockResolvedValue([
      { story_points: 30 },
    ]);
    // Proposed work item has 15 story points -> 45 > 40 -> blocked.

    const input = {
      project_id: VALID_PROJECT_ID,
      sprint_id: VALID_SPRINT_ID,
      story_points: 15,
      title: 'Sprint Item',
      type: 'Task' as const,
      assignee_id: null,
      due_date: null,
    };

    await expect(service.createWorkItem('user-1', input)).rejects.toBeInstanceOf(WorkItemValidationError);
  });

  it('validates member capacity successfully', async () => {
    // User has capacity 40 on the team
    findManyTeamsMock.mockResolvedValue([
      {
        members: [
          { user_id: VALID_ASSIGNEE_ID, capacity: 40, allocation: 100, status: 'active' },
        ],
      },
    ]);
    // Other items in sprint assigned to member: 20 story points.
    findManyWorkItemsMock.mockResolvedValueOnce([
      { story_points: 20 }, // for sprint capacity sum
    ]).mockResolvedValueOnce([
      { story_points: 20 }, // for member capacity sum
    ]);

    mockRepo.create.mockResolvedValue({ id: 'wi-1' });

    const input = {
      project_id: VALID_PROJECT_ID,
      sprint_id: VALID_SPRINT_ID,
      assignee_id: VALID_ASSIGNEE_ID,
      story_points: 10,
      title: 'Member Sprint Item',
      type: 'Task' as const,
      due_date: null,
    };

    await expect(service.createWorkItem('user-1', input)).resolves.toEqual({ id: 'wi-1' });
  });

  it('fails member capacity validation when exceeded', async () => {
    // User has capacity 20 on the team
    findManyTeamsMock.mockResolvedValue([
      {
        members: [
          { user_id: VALID_ASSIGNEE_ID, capacity: 20, allocation: 100, status: 'active' },
        ],
      },
    ]);
    // Other items in sprint: 5.
    // Other items assigned to member in sprint: 15.
    findManyWorkItemsMock.mockResolvedValueOnce([
      { story_points: 5 }, // for sprint capacity sum
    ]).mockResolvedValueOnce([
      { story_points: 15 }, // for member capacity sum
    ]);

    findUniqueUserMock.mockResolvedValue({ name: 'Carol Member' });

    const input = {
      project_id: VALID_PROJECT_ID,
      sprint_id: VALID_SPRINT_ID,
      assignee_id: VALID_ASSIGNEE_ID,
      story_points: 10,
      title: 'Member Sprint Item',
      type: 'Task' as const,
      due_date: null,
    };

    await expect(service.createWorkItem('user-1', input)).rejects.toBeInstanceOf(WorkItemValidationError);
  });

  it('creates a worklog entry when allocation is changed', async () => {
    findManyTeamsMock.mockResolvedValue([
      {
        members: [
          { user_id: VALID_ASSIGNEE_ID, capacity: 40, allocation: 100, status: 'active' },
        ],
      },
    ]);
    findManyWorkItemsMock.mockResolvedValue([]);
    mockRepo.create.mockResolvedValue({ id: 'wi-1' });
    findUniqueSprintMock.mockResolvedValue({ name: 'Sprint 1' });
    findUniqueUserMock.mockResolvedValue({ name: 'Carol Member' });

    const input = {
      project_id: VALID_PROJECT_ID,
      sprint_id: VALID_SPRINT_ID,
      assignee_id: VALID_ASSIGNEE_ID,
      story_points: 5,
      title: 'Sprint Item',
      type: 'Task' as const,
      due_date: null,
    };

    await service.createWorkItem('user-1', input);

    expect(createWorklogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          work_item_id: 'wi-1',
          logged_hours: 0,
          comment: expect.stringContaining('Allocation changed: Assigned to sprint Sprint 1, Assignee set to Carol Member, Story points set to 5'),
        }),
      })
    );
  });
});
