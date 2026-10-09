import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  process.env.GITHUB_ACTIONS = 'true';
});

import type { Database } from '@repo/types';
import type { SupabaseClient } from '@supabase/supabase-js';
import { projectListSelect, projectDetailSelect } from '@repo/types';
import { Prisma } from '@repo/types/prisma';

const {
  findManyMock,
  findUniqueMock,
  countMock,
  groupByMock,
  updateManyMock,
  memberFindManyMock,
  transactionMock,
  projectCreateMock,
  memberCreateManyMock,
  teamCreateMock,
  teamMemberCreateManyMock,
  sprintCreateMock,
} = vi.hoisted(() => ({
  findManyMock: vi.fn(),
  findUniqueMock: vi.fn(),
  countMock: vi.fn(),
  groupByMock: vi.fn(),
  updateManyMock: vi.fn(),
  memberFindManyMock: vi.fn(),
  transactionMock: vi.fn(),
  projectCreateMock: vi.fn(),
  memberCreateManyMock: vi.fn(),
  teamCreateMock: vi.fn(),
  teamMemberCreateManyMock: vi.fn(),
  sprintCreateMock: vi.fn(),
}));

vi.mock('../../src/lib/prisma', () => ({
  prisma: {
    $transaction: transactionMock,
    projects: {
      findMany: findManyMock,
      findUnique: findUniqueMock,
      count: countMock,
      updateMany: updateManyMock,
      create: projectCreateMock,
    },
    teams: {
      groupBy: groupByMock,
      create: teamCreateMock,
    },
    team_members: {
      createMany: teamMemberCreateManyMock,
    },
    project_members: {
      findMany: memberFindManyMock,
      createMany: memberCreateManyMock,
    },
    sprints: {
      create: sprintCreateMock,
    },
  },
}));

import {
  ProjectsRepository,
  type CreateProjectInput,
} from '../../src/routes/api/projects/projects.repository';

const db = {
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        maybeSingle: vi
          .fn()
          .mockResolvedValue({ data: { role: 'admin' }, error: null }),
      })),
    })),
  })),
} as unknown as SupabaseClient<Database>;

const repository = new ProjectsRepository(db);

const mockProjectRow = {
  id: 'project-1',
  name: 'Alice Project',
  key: 'ALICE',
  description: 'A description',
  status: 'active',
  owner_id: 'owner-1',
  start_date: new Date('2026-08-25T12:00:00.000Z'),
  end_date: new Date('2026-08-30T12:00:00.000Z'),
  created_at: new Date('2026-08-25T12:00:00.000Z'),
  updated_at: new Date('2026-08-25T12:00:00.000Z'),
  deleted_at: null,
  logo_url: null,
  cover_picture: null,
  owner: { id: 'owner-1', name: 'Owner', email: 'owner@example.com' },
};

describe('ProjectsRepository Prisma reads', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    transactionMock.mockImplementation(
      async (
        callback: (tx: {
          projects: { create: typeof projectCreateMock };
          project_members: { createMany: typeof memberCreateManyMock };
          teams: { create: typeof teamCreateMock };
          team_members: { createMany: typeof teamMemberCreateManyMock };
          sprints: { create: typeof sprintCreateMock };
        }) => Promise<unknown>
      ) =>
        callback({
          projects: { create: projectCreateMock },
          project_members: { createMany: memberCreateManyMock },
          teams: { create: teamCreateMock },
          team_members: { createMany: teamMemberCreateManyMock },
          sprints: { create: sprintCreateMock },
        })
    );
  });

  it('lists with status filter, search, page slice, and includes team_count', async () => {
    findManyMock.mockResolvedValue([mockProjectRow]);
    countMock.mockResolvedValue(1);
    groupByMock.mockResolvedValue([
      { project_id: 'project-1', _count: { id: 3 } },
    ]);

    const result = await repository.listPaginated({
      accessibleIds: ['project-1'],
      filters: { status: 'active', search: 'Alice' },
      page: 1,
      limit: 10,
    });

    expect(findManyMock).toHaveBeenCalledWith({
      where: {
        id: { in: ['project-1'] },
        deleted_at: null,
        OR: [
          { name: { contains: 'Alice', mode: 'insensitive' } },
          { key: { contains: 'Alice', mode: 'insensitive' } },
          { description: { contains: 'Alice', mode: 'insensitive' } },
        ],
      },
      select: projectListSelect,
      orderBy: { created_at: 'desc' },
      skip: 0,
      take: 10,
    });

    expect(result).toEqual({
      projects: [{ ...mockProjectRow, team_count: 3 }],
      totalCount: 1,
      page: 1,
      limit: 10,
      totalPages: 1,
    });
  });

  it('loads detail by id with projectDetailSelect', async () => {
    findUniqueMock.mockResolvedValue(mockProjectRow);

    const result = await repository.getDetailById('project-1');

    expect(findUniqueMock).toHaveBeenCalledWith({
      where: { id: 'project-1' },
      select: projectDetailSelect,
    });
    expect(result).toEqual(mockProjectRow);
  });

  it('lists only active memberships with active product users for board tools', async () => {
    const user = {
      id: 'user-1',
      name: 'Active Member',
      email: 'active@example.com',
      role: 'member',
    };
    memberFindManyMock.mockResolvedValue([{ user }]);

    await expect(
      repository.listActiveBoardMembers('project-1')
    ).resolves.toEqual([user]);
    expect(memberFindManyMock).toHaveBeenCalledWith({
      where: {
        project_id: 'project-1',
        status: 'active',
        user: { active: true, membership_status: 'active' },
      },
      select: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
      orderBy: { user: { name: 'asc' } },
    });
  });

  it('persists workflow config through the optimistic project update', async () => {
    updateManyMock.mockResolvedValue({ count: 1 });
    const expectedUpdatedAt = '2026-08-25T12:00:00.000Z';
    const lockMs = new Date(expectedUpdatedAt).getTime();
    const workflow_config = {
      version: '1' as const,
      columns: [
        { id: 'new', name: 'New', status: 'New' as const },
        { id: 'todo', name: 'Ready', status: 'ToDo' as const },
        { id: 'doing', name: 'Doing', status: 'InProgress' as const },
        { id: 'testing', name: 'Testing', status: 'Testing' as const },
        { id: 'done', name: 'Done', status: 'Done' as const },
      ],
    };

    await repository.update(
      'project-1',
      { workflow_config },
      'actor-1',
      expectedUpdatedAt
    );

    expect(updateManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'project-1',
          updated_at: {
            gte: new Date(lockMs),
            lt: new Date(lockMs + 1),
          },
        },
        data: expect.objectContaining({ workflow_config }),
      })
    );
  });

  it('preserves workflow config when the field is omitted', async () => {
    updateManyMock.mockResolvedValue({ count: 1 });

    await repository.update(
      'project-1',
      { name: 'Renamed project' },
      'actor-1',
      '2026-08-25T12:00:00.000Z'
    );

    const data = updateManyMock.mock.calls[0]?.[0].data;
    expect(data).not.toHaveProperty('workflow_config');
  });

  it('keeps optimistic-lock conflict behavior for workflow config saves', async () => {
    updateManyMock.mockResolvedValue({ count: 0 });

    await expect(
      repository.update(
        'project-1',
        { workflow_config: null },
        'actor-1',
        '2026-08-25T12:00:00.000Z'
      )
    ).rejects.toMatchObject({ name: 'OptimisticLockError' });
  });

  it('uses the Prisma database-null sentinel when resetting the board', async () => {
    updateManyMock.mockResolvedValue({ count: 1 });

    await repository.update(
      'project-1',
      { workflow_config: null },
      'actor-1',
      '2026-08-25T12:00:00.000Z'
    );

    expect(updateManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ workflow_config: Prisma.DbNull }),
      })
    );
  });

  const createProjectInput = (
    overrides: Partial<CreateProjectInput> = {}
  ): CreateProjectInput => ({
    name: 'Alice Project',
    key: 'ALICE',
    description: null,
    status: 'active',
    start_date: null,
    end_date: null,
    owner_id: 'owner-1',
    jira_project_key: null,
    jira_connection_id: null,
    github_repo: null,
    github_token: null,
    attributes_config: null,
    workflow_config: null,
    ...overrides,
  });

  it('creates project, memberships, and initial sprint in one transaction', async () => {
    projectCreateMock.mockResolvedValue({ id: 'project-1' });
    memberCreateManyMock.mockResolvedValue({ count: 2 });
    sprintCreateMock.mockResolvedValue({ id: 'sprint-1' });

    await repository.create(
      createProjectInput({
        sprint: {
          name: 'Sprint 1',
          goal: '',
          startDate: '2099-09-01',
          endDate: '2099-09-14',
        },
      }),
      'actor-1'
    );

    expect(projectCreateMock).toHaveBeenCalledOnce();
    expect(memberCreateManyMock).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          project_id: 'project-1',
          user_id: 'owner-1',
        }),
        expect.objectContaining({
          project_id: 'project-1',
          user_id: 'actor-1',
        }),
      ],
    });
    expect(sprintCreateMock).toHaveBeenCalledWith({
      data: {
        name: 'Sprint 1',
        goal: null,
        start_date: new Date('2099-09-01'),
        end_date: new Date('2099-09-14'),
        project_id: 'project-1',
        created_by: 'actor-1',
        updated_by: 'actor-1',
      },
    });
    expect(projectCreateMock.mock.invocationCallOrder[0]).toBeLessThan(
      memberCreateManyMock.mock.invocationCallOrder[0]!
    );
    expect(memberCreateManyMock.mock.invocationCallOrder[0]).toBeLessThan(
      sprintCreateMock.mock.invocationCallOrder[0]!
    );
  });

  it('does not insert a sprint when project creation omits it', async () => {
    projectCreateMock.mockResolvedValue({ id: 'project-1' });
    memberCreateManyMock.mockResolvedValue({ count: 2 });

    await repository.create(createProjectInput(), 'actor-1');

    expect(sprintCreateMock).not.toHaveBeenCalled();
    expect(teamCreateMock).not.toHaveBeenCalled();
    expect(teamMemberCreateManyMock).not.toHaveBeenCalled();
  });

  it('creates an initial team and de-duplicates project and team memberships', async () => {
    projectCreateMock.mockResolvedValue({ id: 'project-1' });
    memberCreateManyMock.mockResolvedValue({ count: 4 });
    teamCreateMock.mockResolvedValue({ id: 'team-1' });
    teamMemberCreateManyMock.mockResolvedValue({ count: 2 });

    await repository.create(
      createProjectInput({
        team: {
          name: 'Platform Team',
          description: 'Builds the platform',
          manager_id: 'team-manager',
          tech_stack: 'TypeScript',
          status: 'active',
          member_ids: ['team-member', 'team-member', 'team-manager'],
        },
      }),
      'actor-1'
    );

    expect(memberCreateManyMock).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ user_id: 'owner-1' }),
        expect.objectContaining({ user_id: 'actor-1' }),
        expect.objectContaining({ user_id: 'team-manager' }),
        expect.objectContaining({ user_id: 'team-member' }),
      ],
    });
    expect(teamCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: 'Platform Team',
        manager_id: 'team-manager',
        project_id: 'project-1',
        status: 'active',
      }),
    });
    expect(teamMemberCreateManyMock).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          team_id: 'team-1',
          user_id: 'team-member',
        }),
        expect.objectContaining({
          team_id: 'team-1',
          user_id: 'team-manager',
        }),
      ],
    });
    expect(sprintCreateMock).not.toHaveBeenCalled();
  });

  it('creates initial team and sprint inside the project transaction', async () => {
    projectCreateMock.mockResolvedValue({ id: 'project-1' });
    memberCreateManyMock.mockResolvedValue({ count: 4 });
    teamCreateMock.mockResolvedValue({ id: 'team-1' });
    teamMemberCreateManyMock.mockResolvedValue({ count: 1 });
    sprintCreateMock.mockResolvedValue({ id: 'sprint-1' });

    await repository.create(
      createProjectInput({
        team: {
          name: 'Platform Team',
          manager_id: 'team-manager',
          status: 'active',
          members: [{ user_id: 'team-member', capacity: 40, allocation: 100 }],
        },
        sprint: {
          name: 'Sprint 1',
          goal: null,
          startDate: '2099-09-01',
          endDate: '2099-09-14',
        },
      }),
      'actor-1'
    );

    expect(teamCreateMock).toHaveBeenCalledOnce();
    expect(teamMemberCreateManyMock).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          user_id: 'team-member',
          capacity: 40,
          allocation: 100,
        }),
      ],
    });
    expect(sprintCreateMock).toHaveBeenCalledOnce();
    expect(teamMemberCreateManyMock.mock.invocationCallOrder[0]).toBeLessThan(
      sprintCreateMock.mock.invocationCallOrder[0]!
    );
  });

  it('rejects the project transaction when initial team insertion fails', async () => {
    const teamError = new Error('Team insert failed');
    projectCreateMock.mockResolvedValue({ id: 'project-1' });
    memberCreateManyMock.mockResolvedValue({ count: 3 });
    teamCreateMock.mockRejectedValue(teamError);

    await expect(
      repository.create(
        createProjectInput({
          team: {
            name: 'Platform Team',
            manager_id: 'team-manager',
            status: 'active',
            member_ids: [],
          },
        }),
        'actor-1'
      )
    ).rejects.toBe(teamError);

    expect(transactionMock).toHaveBeenCalledOnce();
    expect(sprintCreateMock).not.toHaveBeenCalled();
  });

  it('propagates a team member insertion failure from the project transaction', async () => {
    const teamMemberError = new Error('Team member insert failed');
    projectCreateMock.mockResolvedValue({ id: 'project-1' });
    memberCreateManyMock.mockResolvedValue({ count: 4 });
    teamCreateMock.mockResolvedValue({ id: 'team-1' });
    teamMemberCreateManyMock.mockRejectedValue(teamMemberError);

    await expect(
      repository.create(
        createProjectInput({
          team: {
            name: 'Platform Team',
            manager_id: 'team-manager',
            status: 'active',
            member_ids: ['team-member'],
          },
        }),
        'actor-1'
      )
    ).rejects.toBe(teamMemberError);

    expect(transactionMock).toHaveBeenCalledOnce();
    expect(projectCreateMock).toHaveBeenCalledOnce();
    expect(teamCreateMock).toHaveBeenCalledOnce();
    expect(teamMemberCreateManyMock).toHaveBeenCalledOnce();
    expect(sprintCreateMock).not.toHaveBeenCalled();
  });

  it('rejects the transaction when initial sprint insertion fails', async () => {
    const sprintError = new Error('Sprint insert failed');
    projectCreateMock.mockResolvedValue({ id: 'project-1' });
    memberCreateManyMock.mockResolvedValue({ count: 2 });
    sprintCreateMock.mockRejectedValue(sprintError);

    await expect(
      repository.create(
        createProjectInput({
          sprint: {
            name: 'Sprint 1',
            goal: null,
            startDate: '2099-09-01',
            endDate: '2099-09-14',
          },
        }),
        'actor-1'
      )
    ).rejects.toBe(sprintError);
  });
});
