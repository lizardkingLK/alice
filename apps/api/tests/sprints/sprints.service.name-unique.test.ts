import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SprintsService } from '../../src/routes/api/sprints/sprints.service';
import type { SprintsRepository } from '../../src/routes/api/sprints/sprints.repository';
import { sprintNameConflictMessage } from '../../src/routes/api/sprints/sprints.errors';

const {
  findByIdMock,
  findByNameInProjectMock,
  createMock,
  updateMock,
  getWorkItemCountMock,
} = vi.hoisted(() => {
  process.env.GITHUB_ACTIONS = 'true';
  return {
    findByIdMock: vi.fn(),
    findByNameInProjectMock: vi.fn(),
    createMock: vi.fn(),
    updateMock: vi.fn(),
    getWorkItemCountMock: vi.fn(),
  };
});

vi.mock('../../src/lib/auth-helpers', () => ({
  requireUserWithRole: vi.fn().mockResolvedValue({
    id: 'user-manager',
    role: 'manager',
  }),
}));

const sprintRow = {
  id: 'sprint-1',
  name: 'Sprint 1',
  goal: null,
  status: 'planned' as const,
  start_date: '2026-09-01',
  end_date: '2026-09-14',
  project_id: 'project-1',
  created_at: '2026-09-01T00:00:00.000Z',
  updated_at: '2026-09-01T00:00:00.000Z',
  created_by: 'user-manager',
  updated_by: 'user-manager',
  project: {
    id: 'project-1',
    name: 'Demo',
    key: 'DEMO',
  },
};

describe('SprintsService name uniqueness', () => {
  let service: SprintsService;
  let repository: SprintsRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = {
      findById: findByIdMock,
      findByNameInProject: findByNameInProjectMock,
      create: createMock,
      update: updateMock,
      getWorkItemCount: getWorkItemCountMock,
    } as unknown as SprintsRepository;
    service = new SprintsService(repository);
  });

  it('rejects create when the name already exists in the project', async () => {
    findByNameInProjectMock.mockResolvedValue({
      id: 'existing',
      name: 'Sprint 1',
      project_id: 'project-1',
      status: 'archived',
    });

    await expect(
      service.createSprint('user-manager', {
        name: 'Sprint 1',
        projectId: 'project-1',
        startDate: '2026-09-01',
        endDate: '2026-09-14',
      })
    ).rejects.toThrow(sprintNameConflictMessage());

    expect(createMock).not.toHaveBeenCalled();
  });

  it('rejects update when another sprint in the project has the same name', async () => {
    findByIdMock.mockResolvedValue(sprintRow);
    findByNameInProjectMock.mockResolvedValue({
      id: 'other-sprint',
      name: 'Sprint 1',
      project_id: 'project-1',
      status: 'closed',
    });

    await expect(
      service.updateSprint('user-manager', 'sprint-1', {
        name: 'Sprint 1',
        projectId: 'project-1',
        startDate: '2026-09-01',
        endDate: '2026-09-14',
        expectedUpdatedAt: sprintRow.updated_at,
      })
    ).rejects.toThrow(sprintNameConflictMessage());

    expect(updateMock).not.toHaveBeenCalled();
  });

  it('creates when the name is unique for the project', async () => {
    findByNameInProjectMock.mockResolvedValue(null);
    createMock.mockResolvedValue(sprintRow);

    const result = await service.createSprint('user-manager', {
      name: 'Sprint 1',
      projectId: 'project-1',
      startDate: '2026-09-01',
      endDate: '2026-09-14',
    });

    expect(result.name).toBe('Sprint 1');
    expect(createMock).toHaveBeenCalled();
  });
});
